import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class LangualCodesService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getLangualCodes(): Promise<Array<CamelCaseRecord<Database.LangualCode>>> {
        return await this.db
            .selectFrom("langual_code")
            .select([
                "id",
                "code",
                "descriptor",
                "parent_id as parentId",
            ])
            .execute();
    }

    public async getLangualCodeIds(): Promise<Array<Pick<LangualCode, "id" | "code">>> {
        return await this.db
            .selectFrom("langual_code")
            .select([
                "id",
                "code",
            ])
            .execute();
    }

    public async getLangualCodesWithParent(): Promise<LangualCodeWithParent[]> {
        return await this.db
            .selectFrom("langual_code as lc")
            .leftJoin("langual_code as pc", "pc.id", "lc.parent_id")
            .select([
                "lc.id",
                "lc.code",
                "lc.descriptor",
                "pc.id as parentId",
                "pc.code as parentCode",
                "pc.descriptor as parentDescriptor",
            ])
            .execute();
    }

    public async langualCodesExistById(ids: number[]): Promise<boolean[]> {
        const langualCodes = await this.db
            .selectFrom("langual_code")
            .select("id")
            .where("id", "in", ids)
            .execute();

        const dbIds = new Set(langualCodes.map(v => v.id));

        return ids.map(id => dbIds.has(id));
    }
}

export type LangualCodeWithParent = LangualCode & NullableRecord<PickWithAlias<
    Database.LangualCode,
    "id => parentId" | "code => parentCode" | "descriptor => parentDescriptor"
>>;

type LangualCode = Omit<Database.LangualCode, "parent_id">;
