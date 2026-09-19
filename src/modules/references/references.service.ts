import {Database, InjectDatabase} from "@database";
import {Injectable} from "@nestjs/common";
import {GetReferencesQueryDto, NewBatchReferenceDto, NewReferenceDto} from "./dtos";
import NewReference = Database.NewReference;

@Injectable()
export class ReferencesService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getReferences(query: GetReferencesQueryDto): Promise<Reference[]> {
        const {text} = query;

        let dbQuery = this.db
            .selectFrom("reference as r")
            .select(["r.code", "r.text"])
            .orderBy("r.text");

        if (text) {
            dbQuery = dbQuery.where("r.text", "like", "%" + text + "%");
        }
        return dbQuery.execute();
    }

    public async getReferenceCodes(): Promise<Set<number>> {
        const references = await this.db
            .selectFrom("reference")
            .select("code")
            .execute();

        return new Set(references.map(v => v.code));
    }

    public async getRawReferences(): Promise<RawReference[]> {
        return this.db
            .selectFrom("reference as r")
            .select([
                "r.code",
                "r.text",
            ])
            .orderBy("r.text")
            .execute();
    }

    public async referenceExists(code: number): Promise<boolean> {
        const reference = await this.db
            .selectFrom("reference")
            .select("code")
            .where("code", "=", code)
            .executeTakeFirst();

        return !!reference;
    }

    public async referencesExist(codes: number[]): Promise<boolean[]> {
        const references = await this.db
            .selectFrom("reference")
            .select("code")
            .where("code", "in", codes)
            .execute();

        const dbCodes = new Set(references.map(v => v.code));

        return codes.map(code => dbCodes.has(code));
    }

    public async createReference(
        code: number,
        newReference: NewReferenceDto
    ): Promise<void> {
        await this.db
            .insertInto("reference")
            .values({
                code,
                text: newReference.text,
            })
            .execute();
    }

    public async batchCreateReferences(references: NewBatchReferenceDto[]): Promise<void> {
        const { newReferences} = this.preprocessBatchReferences(references);

        await this.db.transaction().execute(async (tsx) => {

            const referenceValues: Database.NewReference[] = [];

            for (const reference of newReferences) {
                const {code, text} = reference;

                referenceValues.push({ code, text });
            }

            await tsx
                .insertInto("reference")
                .values(referenceValues)
                .execute();
        });
    }

    private preprocessBatchReferences(references: NewBatchReferenceDto[]): ProcessedReferences {

        const newReferences: NewReference[] = [];

        for (const reference of references) {
            const {
                code,
                text,
            } = reference;

            const referenceObject: NewReference = {code, text};
            newReferences.push(referenceObject);

        }
        return {
            newReferences,
        };
    }
}

type Reference = {
    code: number;
    text: string;
};

type RawReference = {
    code: number;
    text: string;
};

type ProcessedReferences = {
    newReferences: NewReference[];
};
