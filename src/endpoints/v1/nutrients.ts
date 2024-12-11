import { Request, Response } from "express";
import { Micronutrient, Nutrient } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import { BooleanValueValidator, IDValueValidator, StringValueValidator, Validator } from "../validator";

export class NutrientsEndpoint extends Endpoint {
    private readonly newNutrientValidator: Validator<NewNutrient>;

    public constructor() {
        super("/nutrients");

        this.newNutrientValidator = new Validator<NewNutrient>(
            {
                type: new StringValueValidator({
                    required: true,
                    oneOf: new Set(["energy", "macronutrient", "component", "micronutrient"]),
                }),
                name: new StringValueValidator({
                    required: true,
                    maxLength: 32,
                }),
                measurementUnit: new StringValueValidator({
                    required: true,
                    maxLength: 8,
                }),
                standardized: new BooleanValueValidator(false),
                note: new StringValueValidator({
                    required: false,
                    maxLength: 100,
                }),
                macronutrientId: new IDValueValidator({
                    required: false,
                    validate: async (value, key) => {
                        const macronutrientQuery = await this.queryDB(db => db
                            .selectFrom("nutrient")
                            .select("id")
                            .where("id", "=", value)
                            .where("type", "=", "macronutrient")
                            .executeTakeFirst()
                        );

                        if (!macronutrientQuery.ok) return macronutrientQuery;

                        return macronutrientQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. Macronutrient ${value} does not exist.`,
                        };
                    },
                }),
                micronutrientType: new StringValueValidator<Micronutrient["type"] | undefined>({
                    required: false,
                    oneOf: new Set(["vitamin", "mineral"]),
                }),
            },
            async (object) => {
                object.name = capitalize(object.name);

                const { type, name, measurementUnit, macronutrientId, micronutrientType } = object;

                if (type !== "component" && typeof macronutrientId !== "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Only component nutrients should have a macronutrientId.",
                    };
                }

                if (type === "component" && typeof macronutrientId === "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Component nutrients must have a macronutrientId.",
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
                    .executeTakeFirst()
                );

                if (!existingNutrient.ok) return existingNutrient;

                return !existingNutrient.value ? {
                    ok: true,
                    value: object,
                } : {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: `Nutrient of type ${type} and name '${name}' already exists.`,
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

        const {
            type,
            name,
            measurementUnit,
            standardized,
            note,
            macronutrientId,
            micronutrientType,
        } = validationResult.value;

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
                        macronutrient_id: macronutrientId!,
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

function capitalize(text: string): string {
    return text[0].toUpperCase() + text.slice(1);
}

type NewNutrient = {
    type: Nutrient["type"];
    name: string;
    measurementUnit: string;
    standardized?: boolean;
    note?: string;
    macronutrientId?: number;
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
