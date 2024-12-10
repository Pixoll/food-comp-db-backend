import { Request, Response } from "express";
import { Micronutrient, Nutrient } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import { Validator } from "../validator";

export class NutrientsEndpoint extends Endpoint {
    private readonly newNutrientValidator: Validator<NewNutrient>;

    public constructor() {
        super("/nutrients");

        const nutrientTypes = new Set<string>(
            ["energy", "macronutrient", "component", "micronutrient"] as const satisfies Array<Nutrient["type"]>
        );
        const micronutrientTypes = new Set<string>(["vitamin", "mineral"] as const satisfies Array<Micronutrient["type"]>);

        this.newNutrientValidator = new Validator<NewNutrient>(
            {
                type: {
                    required: true,
                    validate: (value) => {
                        const ok = !!value && typeof value === "string" && nutrientTypes.has(value);
                        return { ok };
                    },
                },
                name: {
                    required: true,
                    validate: (value) => {
                        const ok = !!value && typeof value === "string" && value.length <= 32;
                        return { ok };
                    },
                },
                measurementUnit: {
                    required: true,
                    validate: (value) => {
                        const ok = !!value && typeof value === "string" && value.length <= 8;
                        return { ok };
                    },
                },
                standardized: (value) => {
                    const ok = typeof value === "undefined" || typeof value === "boolean";
                    return { ok };
                },
                note: (value) => {
                    const ok = typeof value === "undefined" || (!!value && typeof value === "string" && value.length <= 100);
                    return { ok };
                },
                parentId: async (value) => {
                    if (typeof value === "undefined") {
                        return { ok: true };
                    }

                    const ok = !!value && typeof value === "number" && value > 0;
                    if (!ok) {
                        return { ok };
                    }

                    const parentQuery = await this.queryDB(db => db
                        .selectFrom("nutrient")
                        .select("id")
                        .where("id", "=", value)
                        .where("type", "=", "macronutrient")
                        .execute()
                    );

                    if (!parentQuery.ok) return parentQuery;

                    return parentQuery.value ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Macronutrient ${value} does not exist.`,
                    };
                },
                micronutrientType: (value) => {
                    const ok = typeof value === "undefined"
                        || (!!value && typeof value === "string" && micronutrientTypes.has(value));
                    return { ok };
                },
            },
            async ({ type, name, measurementUnit, parentId, micronutrientType }) => {
                if (type !== "component" && typeof parentId !== "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Only component nutrients should have a parentId.",
                    };
                }

                if (type === "component" && typeof parentId === "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Component nutrients must have a parentId.",
                    };
                }

                if (type !== "micronutrient" && typeof micronutrientType !== "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Only micronutrients should have a micronutrientType.",
                    };
                }

                if (type === "micronutrient" && typeof micronutrientType === "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Micronutrients must have a micronutrientType.",
                    };
                }

                const existingNutrient = await this.queryDB(db => db
                    .selectFrom("nutrient")
                    .select("id")
                    .where("type", "=", type)
                    .where("name", "like", name)
                    .where("measurement_unit", "like", measurementUnit)
                    .execute()
                );

                if (!existingNutrient.ok) return existingNutrient;

                return !existingNutrient.value ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: `Nutrient of type ${type} and name "${name}" already exists.`,
                };
            }
        );
    }

    @GetMethod()
    public async getNutrients(_request: Request, response: Response<GroupedNutrients>): Promise<void> {
        const nutrientsQuery = await this.queryDB(db => db
            .selectFrom("nutrient as n")
            .leftJoin("nutrient_component as c", "c.id", "n.id")
            .leftJoin("micronutrient as m", "m.id", "n.id")
            .select([
                "n.id",
                "n.type",
                "n.name",
                "n.measurement_unit as measurementUnit",
                "n.standardized",
                "n.note",
                "c.macronutrient_id as parentId",
                "m.type as micronutrientType",
            ])
            .orderBy("n.id")
            .execute()
        );

        if (!nutrientsQuery.ok) {
            this.sendInternalServerError(response, nutrientsQuery.message);
            return;
        }

        const nutrients = nutrientsQuery.value;
        const macronutrients = new Map<number, MacroNutrient>();
        const vitamins = new Map<number, AnyNutrient>();
        const minerals = new Map<number, AnyNutrient>();

        for (const { id, type, name, measurementUnit, standardized, note, parentId, micronutrientType } of nutrients) {
            const commonData = {
                id,
                name,
                measurementUnit,
                standardized,
                ...note && { note },
            };

            switch (type) {
                case "energy":
                case "macronutrient": {
                    macronutrients.set(id, {
                        ...commonData,
                        ...type === "energy" && { isEnergy: true },
                        components: [],
                    });
                    break;
                }
                case "micronutrient": {
                    const destination = micronutrientType === "vitamin" ? vitamins : minerals;
                    destination.set(id, commonData);
                    break;
                }
                case "component": {
                    macronutrients.get(parentId!)?.components?.push(commonData);
                }
            }
        }

        const result: GroupedNutrients = {
            macronutrients: [...macronutrients.values()],
            micronutrients: {
                vitamins: [...vitamins.values()],
                minerals: [...minerals.values()],
            },
        };

        this.sendOk(response, result);
    }

    @PostMethod()
    public async createNutrient(request: Request<unknown, unknown, NewNutrient>, response: Response): Promise<void> {
        const validationResult = await this.newNutrientValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const { type, name, measurementUnit, standardized, note, parentId, micronutrientType } = validationResult.value;

        const insertQuery = await this.queryDB(db => db.transaction().execute(async (tsx) => {
            await tsx
                .insertInto("nutrient")
                .values({
                    type,
                    name,
                    measurement_unit: measurementUnit,
                    standardized,
                    note,
                })
                .execute();

            if (type !== "component" && type !== "micronutrient") {
                return;
            }

            const newNutrient = await tsx
                .selectFrom("nutrient")
                .select("id")
                .where("type", "=", type)
                .where("name", "like", name)
                .executeTakeFirst();

            if (!newNutrient) {
                throw new Error("Failed to obtain id of new nutrient.");
            }

            const nutrientId = newNutrient.id;

            if (type === "component") {
                await tsx
                    .insertInto("nutrient_component")
                    .values({
                        id: nutrientId,
                        macronutrient_id: parentId!,
                    })
                    .execute();
            } else {
                await tsx
                    .insertInto("micronutrient")
                    .values({
                        id: nutrientId,
                        type: micronutrientType!,
                    })
                    .execute();
            }
        }));

        if (!insertQuery.ok) {
            this.sendInternalServerError(response, insertQuery.message);
            return;
        }

        this.sendStatus(response, HTTPStatus.CREATED);
    }
}

type NewNutrient = {
    type: Nutrient["type"];
    name: string;
    measurementUnit: string;
    standardized?: boolean;
    note?: string;
    parentId?: number;
    micronutrientType?: Micronutrient["type"];
};

type GroupedNutrients = {
    macronutrients: MacroNutrient[];
    micronutrients: {
        vitamins: AnyNutrient[];
        minerals: AnyNutrient[];
    };
};

type MacroNutrient = AnyNutrient & {
    isEnergy?: true;
    components?: AnyNutrient[];
};

type AnyNutrient = Omit<Nutrient, "measurement_unit" | "note" | "type"> & {
    measurementUnit: string;
    note?: string;
};
