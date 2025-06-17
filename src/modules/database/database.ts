// noinspection JSUnusedGlobalSymbols

import { Logger } from "@nestjs/common";
import { config as dotenv } from "dotenv";
import {
    ColumnType,
    Expression,
    Insertable,
    Kysely,
    MysqlDialect,
    RawBuilder,
    Selectable,
    Simplify,
    sql,
    Updateable,
} from "kysely";
import type { SelectQueryBuilderExpression } from "kysely/dist/cjs/query-builder/select-query-builder-expression";
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from "kysely/helpers/mysql";
import { createPool } from "mysql2";
import { Field, Next } from "mysql2/typings/mysql/lib/parsers/typeCast";

export class Database extends Kysely<Database.Tables> {
    private static INSTANCE: Database | undefined;
    private readonly logger = new Logger(Database.name);

    private constructor() {
        dotenv();

        const {
            DATABASE_HOST,
            DATABASE_PORT,
            DATABASE_USERNAME,
            DATABASE_PASSWORD,
            DATABASE_NAME,
            NO_COLOR,
        } = process.env;

        super({
            log: (event) => {
                if (event.level === "query") {
                    const ms = event.queryDurationMillis.toFixed(2);
                    const formattedMs = !NO_COLOR ? `\x1B[38;5;3m${ms}ms\x1B[39m` : ms;
                    this.logger.log(`Executed query. Took ${formattedMs}: ${event.query.sql}`);
                }
            },
            dialect: new MysqlDialect({
                pool: createPool({
                    host: DATABASE_HOST,
                    port: DATABASE_PORT ? +DATABASE_PORT : undefined,
                    user: DATABASE_USERNAME,
                    password: DATABASE_PASSWORD,
                    database: DATABASE_NAME,
                    supportBigNumbers: true,
                    bigNumberStrings: true,
                    dateStrings: false,
                    typeCast(field: Field, next: Next) {
                        if (field.type === "TINY" && field.length === 1) {
                            return field.string() === "1";
                        }
                        if (field.type === "DECIMAL" || field.type === "NEWDECIMAL") {
                            const value = field.string();
                            return value ? +value : null;
                        }
                        return next();
                    },
                }),
            }),
        });

        this.logger.log("Database connected");
    }

    public static getInstance(): Database {
        return Database.INSTANCE ??= new Database();
    }

    /**
     * A MySQL helper for aggregating a subquery into a JSON array.
     *
     * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
     * While the produced SQL is compatible with all MySQL databases, some third-party dialects
     * may not parse the nested JSON into arrays. In these cases you can use the built-in
     * `ParseJSONResultsPlugin` to parse the results.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select((eb) => [
     *     'id',
     *     jsonArrayFrom(
     *       eb.selectFrom('pet')
     *         .select(['pet.id as pet_id', 'pet.name'])
     *         .whereRef('pet.owner_id', '=', 'person.id')
     *         .orderBy('pet.name')
     *     ).as('pets')
     *   ])
     *   .execute()
     *
     * result[0].id
     * result[0].pets[0].pet_id
     * result[0].pets[0].name
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * select `id`, (
     *   select cast(coalesce(json_arrayagg(json_object(
     *     'pet_id', `agg`.`pet_id`,
     *     'name', `agg`.`name`
     *   )), '[]') as json) from (
     *     select `pet`.`id` as `pet_id`, `pet`.`name`
     *     from `pet`
     *     where `pet`.`owner_id` = `person`.`id`
     *     order by `pet`.`name`
     *   ) as `agg`
     * ) as `pets`
     * from `person`
     * ```
     */
    public jsonObjectArrayFrom<O>(expr: SelectQueryBuilderExpression<O>): RawBuilder<Array<Simplify<O>>> {
        return jsonArrayFrom(expr);
    }

    /**
     * A MySQL helper for aggregating a single-column subquery into a JSON array.
     *
     * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
     * While the produced SQL is compatible with all MySQL databases, some third-party dialects
     * may not parse the nested JSON into arrays. In these cases you can use the built-in
     * `ParseJSONResultsPlugin` to parse the results.
     */
    public jsonArrayFrom<O>(
        expr: SelectQueryBuilderExpression<O>
    ): HasOneKey<O> extends true ? RawBuilder<Array<Simplify<O[keyof O]>>> : never {
        const { selections } = expr.toOperationNode();
        if (selections?.length !== 1) {
            throw new Error("jsonArrayFrom only supports selections with 1 column");
        }
        const selection = selections[0]?.selection;
        if (selection?.kind !== "ReferenceNode") {
            throw new Error("jsonArrayFrom only supports reference selections");
        }
        if (selection.column.kind !== "ColumnNode") {
            throw new Error("jsonArrayFrom doesn't support selectAll()");
        }
        const column = selection.column.column.name;
        return sql`(select coalesce(json_arrayagg(${sql.ref(`agg.${column}`)}), json_array()) from ${expr} as agg)`;
    }

    /**
     * A combination of the MySQL functions `json_array` and `json_object`.
     *
     * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
     * While the produced SQL is compatible with all MySQL databases, some third-party dialects
     * may not parse the nested JSON into arrays. In these cases you can use the built-in
     * `ParseJSONResultsPlugin` to parse the results.
     */
    public jsonBuildObjectArray<O extends Record<string, Expression<unknown>>>(obj: O): RawBuilder<Array<Simplify<{
        [K in keyof O]: O[K] extends Expression<infer V> ? V : never;
    }>>> {
        return sql`coalesce(json_array(${jsonBuildObject(obj)}), json_array())`;
    }

    /**
     * A combination of the MySQL functions `json_arrayagg` and `json_object`.
     *
     * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
     * While the produced SQL is compatible with all MySQL databases, some third-party dialects
     * may not parse the nested JSON into arrays. In these cases you can use the built-in
     * `ParseJSONResultsPlugin` to parse the results.
     */
    public jsonBuildObjectArrayAgg<O extends Record<string, Expression<unknown>>>(obj: O): RawBuilder<Array<Simplify<{
        [K in keyof O]: O[K] extends Expression<infer V> ? V : never;
    }>>> {
        return sql`coalesce(json_arrayagg(${jsonBuildObject(obj)}), json_array())`;
    }

    /**
     * The MySQL `json_arrayagg` function.
     *
     * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
     * While the produced SQL is compatible with all MySQL databases, some third-party dialects
     * may not parse the nested JSON into objects. In these cases you can use the built-in
     * `ParseJSONResultsPlugin` to parse the results.
     */
    public jsonArrayAgg<V>(expr: Expression<V>): RawBuilder<Array<Simplify<V>>> {
        return sql`coalesce(json_arrayagg(${expr}), json_array())`;
    }

    /**
     * A MySQL helper for turning a subquery into a JSON object.
     *
     * The subquery must only return one row.
     *
     * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
     * While the produced SQL is compatible with all MySQL databases, some third-party dialects
     * may not parse the nested JSON into objects. In these cases you can use the built-in
     * `ParseJSONResultsPlugin` to parse the results.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select((eb) => [
     *     'id',
     *     jsonObjectFrom(
     *       eb.selectFrom('pet')
     *         .select(['pet.id as pet_id', 'pet.name'])
     *         .whereRef('pet.owner_id', '=', 'person.id')
     *         .where('pet.is_favorite', '=', true)
     *     ).as('favorite_pet')
     *   ])
     *   .execute()
     *
     * result[0].id
     * result[0].favorite_pet.pet_id
     * result[0].favorite_pet.name
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * select `id`, (
     *   select json_object(
     *     'pet_id', `obj`.`pet_id`,
     *     'name', `obj`.`name`
     *   ) from (
     *     select `pet`.`id` as `pet_id`, `pet`.`name`
     *     from `pet`
     *     where `pet`.`owner_id` = `person`.`id`
     *     and `pet`.`is_favorite` = ?
     *   ) as obj
     * ) as `favorite_pet`
     * from `person`
     * ```
     */
    public jsonObjectFrom<O>(expr: SelectQueryBuilderExpression<O>): RawBuilder<Simplify<O> | null> {
        return jsonObjectFrom(expr);
    }

    /**
     * The MySQL `json_object` function.
     *
     * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
     * While the produced SQL is compatible with all MySQL databases, some third-party dialects
     * may not parse the nested JSON into objects. In these cases you can use the built-in
     * `ParseJSONResultsPlugin` to parse the results.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select((eb) => [
     *     'id',
     *     jsonBuildObject({
     *       first: eb.ref('first_name'),
     *       last: eb.ref('last_name'),
     *       full: eb.fn('concat', ['first_name', eb.val(' '), 'last_name'])
     *     }).as('name')
     *   ])
     *   .execute()
     *
     * result[0].id
     * result[0].name.first
     * result[0].name.last
     * result[0].name.full
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * select "id", json_object(
     *   'first', first_name,
     *   'last', last_name,
     *   'full', concat(`first_name`, ?, `last_name`)
     * ) as "name"
     * from "person"
     * ```
     */
    public jsonBuildObject<O extends Record<string, Expression<unknown>>>(obj: O): RawBuilder<Simplify<{
        [K in keyof O]: O[K] extends Expression<infer V> ? V : never;
    }>> {
        return jsonBuildObject(obj);
    }

    /**
     * The MySQL `json_objectagg` function. Uses the result from `expr1` as the key, and `expr2` as the value.
     *
     * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
     * While the produced SQL is compatible with all MySQL databases, some third-party dialects
     * may not parse the nested JSON into objects. In these cases you can use the built-in
     * `ParseJSONResultsPlugin` to parse the results.
     */
    public jsonObjectAgg<E1 extends Expression<unknown>, E2 extends Expression<unknown>>(
        expr1: E1,
        expr2: E2
    ): RawBuilder<Simplify<{
        [P in (E1 extends Expression<infer K> ? K & string : never)]: E2 extends Expression<infer V> ? V : never;
    }>> {
        return sql`json_objectagg(${expr1}, ${expr2})`;
    }

    /**
     * The MySQL `concat_ws` function. Concatenates the results of the expressions with the separator.
     *
     * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
     * While the produced SQL is compatible with all MySQL databases, some third-party dialects
     * may not parse the nested JSON into objects. In these cases you can use the built-in
     * `ParseJSONResultsPlugin` to parse the results.
     */
    public concatWithSeparator(separator: " " | ", ", ...expressions: Array<Expression<unknown>>): RawBuilder<string> {
        if (separator !== " " && separator !== ", ") {
            throw new RangeError("Separator can only be space or comma");
        }
        return sql<string>`concat_ws(${sql.lit(separator)}, ${sql.join(expressions)})`;
    }

    /**
     * The MySQL `last_insert_id` function.
     *
     * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
     * While the produced SQL is compatible with all MySQL databases, some third-party dialects
     * may not parse the nested JSON into objects. In these cases you can use the built-in
     * `ParseJSONResultsPlugin` to parse the results.
     */
    public getLastInsertId(): RawBuilder<Database.BigIntString> {
        return sql<Database.BigIntString>`last_insert_id()`;
    }
}

type HasOneKey<O> = keyof O extends infer K
    ? K extends string
        // @ts-expect-error: P is a key of O
        ? { [P in K]: O[P] } extends O
            ? true
            : false
        : never
    : never;

type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Database {
    /**
     * String representation of a 64-bit integer.
     */
    export type BigIntString = `${number}`;

    /**
     * - Table name: `commune`
     * - Primary key: `(id)`
     */
    export type CommuneTable = {
        /**
         * - SQL: `id mediumint unsigned primary key`
         * - Foreign key: `origin.id`
         */
        id: number;
        /**
         * - SQL: `province_id mediumint unsigned not null`
         * - Foreign key: `province.id`
         */
        province_id: number;
    };

    export type Commune = Selectable<CommuneTable>;
    export type NewCommune = Insertable<CommuneTable>;
    export type CommuneUpdate = Updateable<CommuneTable>;

    /**
     * - Table name: `db_admin`
     * - Primary key: `(username)`
     * - Indexes:
     *   - `(session_token)`
     */
    export type DbAdminTable = {
        /**
         * - SQL: `username varchar(32) not null primary key check (username = "root" or username regexp
         * "^[a-za-z0-9_.]{8,32}$")`
         */
        username: string;
        /**
         * - SQL: `password char(86) not null check (password != "")`
         */
        password: string;
        /**
         * - SQL: `salt char(43) not null check (salt != "")`
         */
        salt: string;
        /**
         * - SQL: `session_token char(86) unique check (session_token is null or session_token != "")`
         */
        session_token: string | null;
        /**
         * - SQL: `expires_at datetime`
         */
        expires_at: Date | null;
    };

    export type DbAdmin = Selectable<DbAdminTable>;
    export type NewDbAdmin = Insertable<DbAdminTable>;
    export type DbAdminUpdate = Updateable<DbAdminTable>;

    /**
     * - Table name: `food`
     * - Primary key: `(id)`
     * - Indexes:
     *   - `(code)`
     */
    export type FoodTable = {
        /**
         * - SQL: `id bigint unsigned primary key auto_increment`
         */
        id: Generated<BigIntString>;
        /**
         * - SQL: `code char(8) unique not null check (code = upper(code) and length(code) = 8)`
         */
        code: string;
        /**
         * - SQL: `group_id tinyint unsigned not null`
         * - Foreign key: `food_group.id`
         */
        group_id: number;
        /**
         * - SQL: `type_id tinyint unsigned not null`
         * - Foreign key: `food_type.id`
         */
        type_id: number;
        /**
         * - SQL: `scientific_name_id int unsigned`
         * - Foreign key: `scientific_name.id`
         */
        scientific_name_id: number | null;
        /**
         * - SQL: `subspecies_id int unsigned`
         * - Foreign key: `subspecies.id`
         */
        subspecies_id: number | null;
        /**
         * - SQL: `strain varchar(50) check (strain is null or strain != "")`
         */
        strain: string | null;
        /**
         * - SQL: `brand varchar(8) check (brand is null or brand != "")`
         */
        brand: string | null;
        /**
         * - SQL: `observation varchar(200) check (observation is null or observation != "")`
         */
        observation: string | null;
    };

    export type Food = Selectable<FoodTable>;
    export type NewFood = Insertable<FoodTable>;
    export type FoodUpdate = Updateable<FoodTable>;

    /**
     * - Table name: `food_group`
     * - Primary key: `(id)`
     * - Indexes:
     *   - `(code)`
     *   - `(name)`
     */
    export type FoodGroupTable = {
        /**
         * - SQL: `id tinyint unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `code char(1) unique not null check (code = upper(code) and length(code) = 1)`
         */
        code: string;
        /**
         * - SQL: `name varchar(128) unique not null check (name != "")`
         */
        name: string;
    };

    export type FoodGroup = Selectable<FoodGroupTable>;
    export type NewFoodGroup = Insertable<FoodGroupTable>;
    export type FoodGroupUpdate = Updateable<FoodGroupTable>;

    /**
     * - Table name: `food_langual_code`
     * - Primary key: `(food_id, langual_id)`
     */
    export type FoodLangualCodeTable = {
        /**
         * - SQL: `food_id bigint unsigned not null`
         * - Foreign key: `food.id`
         */
        food_id: BigIntString;
        /**
         * - SQL: `langual_id smallint unsigned not null`
         * - Foreign key: `langual_code.id`
         */
        langual_id: number;
    };

    export type FoodLangualCode = Selectable<FoodLangualCodeTable>;
    export type NewFoodLangualCode = Insertable<FoodLangualCodeTable>;
    export type FoodLangualCodeUpdate = Updateable<FoodLangualCodeTable>;

    /**
     * - Table name: `food_origin`
     * - Primary key: `(food_id, origin_id)`
     */
    export type FoodOriginTable = {
        /**
         * - SQL: `food_id bigint unsigned not null`
         * - Foreign key: `food.id`
         */
        food_id: BigIntString;
        /**
         * - SQL: `origin_id mediumint unsigned not null`
         * - Foreign key: `origin.id`
         */
        origin_id: number;
    };

    export type FoodOrigin = Selectable<FoodOriginTable>;
    export type NewFoodOrigin = Insertable<FoodOriginTable>;
    export type FoodOriginUpdate = Updateable<FoodOriginTable>;

    /**
     * - Table name: `food_translation`
     * - Primary key: `(food_id, language_id)`
     */
    export type FoodTranslationTable = {
        /**
         * - SQL: `food_id bigint unsigned not null`
         * - Foreign key: `food.id`
         */
        food_id: BigIntString;
        /**
         * - SQL: `language_id tinyint unsigned not null`
         * - Foreign key: `language.id`
         */
        language_id: number;
        /**
         * - SQL: `common_name varchar(200)`
         */
        common_name: string | null;
        /**
         * - SQL: `ingredients varchar(400)`
         */
        ingredients: string | null;
    };

    export type FoodTranslation = Selectable<FoodTranslationTable>;
    export type NewFoodTranslation = Insertable<FoodTranslationTable>;
    export type FoodTranslationUpdate = Updateable<FoodTranslationTable>;

    /**
     * - Table name: `food_type`
     * - Primary key: `(id)`
     * - Indexes:
     *   - `(code)`
     *   - `(name)`
     */
    export type FoodTypeTable = {
        /**
         * - SQL: `id tinyint unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `code char(1) unique not null check (code = upper(code) and length(code) = 1)`
         */
        code: string;
        /**
         * - SQL: `name varchar(64) unique not null check (name != "")`
         */
        name: string;
    };

    export type FoodType = Selectable<FoodTypeTable>;
    export type NewFoodType = Insertable<FoodTypeTable>;
    export type FoodTypeUpdate = Updateable<FoodTypeTable>;

    /**
     * - Table name: `journal`
     * - Primary key: `(id)`
     * - Indexes:
     *   - `(name)`
     */
    export type JournalTable = {
        /**
         * - SQL: `id int unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `name varchar(100) unique not null check (name != "")`
         */
        name: string;
    };

    export type Journal = Selectable<JournalTable>;
    export type NewJournal = Insertable<JournalTable>;
    export type JournalUpdate = Updateable<JournalTable>;

    /**
     * - Table name: `journal_volume`
     * - Primary key: `(id)`
     */
    export type JournalVolumeTable = {
        /**
         * - SQL: `id int unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `journal_id int unsigned not null`
         * - Foreign key: `journal.id`
         */
        journal_id: number;
        /**
         * - SQL: `volume int unsigned not null`
         */
        volume: number;
        /**
         * - SQL: `issue int unsigned not null`
         */
        issue: number;
        /**
         * - SQL: `year smallint unsigned not null`
         */
        year: number;
    };

    export type JournalVolume = Selectable<JournalVolumeTable>;
    export type NewJournalVolume = Insertable<JournalVolumeTable>;
    export type JournalVolumeUpdate = Updateable<JournalVolumeTable>;

    export enum LanguageCode {
        ES = "es",
        EN = "en",
        PT = "pt",
    }

    /**
     * - Table name: `language`
     * - Primary key: `(id)`
     * - Indexes:
     *   - `(code)`
     *   - `(name)`
     */
    export type LanguageTable = {
        /**
         * - SQL: `id tinyint unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `code enum("es", "en", "pt") unique not null`
         */
        code: LanguageCode;
        /**
         * - SQL: `name varchar(32) unique not null check (name != "")`
         */
        name: string;
    };

    export type Language = Selectable<LanguageTable>;
    export type NewLanguage = Insertable<LanguageTable>;
    export type LanguageUpdate = Updateable<LanguageTable>;

    /**
     * - Table name: `langual_code`
     * - Primary key: `(id)`
     * - Indexes:
     *   - `(code)`
     */
    export type LangualCodeTable = {
        /**
         * - SQL: `id smallint unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `code char(5) unique not null check (code = upper(code) and length(code) = 5)`
         */
        code: string;
        /**
         * - SQL: `descriptor varchar(150) not null check (descriptor != "")`
         */
        descriptor: string;
        /**
         * - SQL: `parent_id smallint unsigned`
         * - Foreign key: `langual_code.id`
         */
        parent_id: number | null;
    };

    export type LangualCode = Selectable<LangualCodeTable>;
    export type NewLangualCode = Insertable<LangualCodeTable>;
    export type LangualCodeUpdate = Updateable<LangualCodeTable>;

    export enum LocationType {
        CITY = "city",
        TOWN = "town",
    }

    /**
     * - Table name: `location`
     * - Primary key: `(id)`
     */
    export type LocationTable = {
        /**
         * - SQL: `id mediumint unsigned primary key`
         * - Foreign key: `origin.id`
         */
        id: number;
        /**
         * - SQL: `type enum("city", "town") not null`
         */
        type: LocationType;
        /**
         * - SQL: `commune_id mediumint unsigned not null`
         * - Foreign key: `commune.id`
         */
        commune_id: number;
    };

    export type Location = Selectable<LocationTable>;
    export type NewLocation = Insertable<LocationTable>;
    export type LocationUpdate = Updateable<LocationTable>;

    export enum MeasurementDataType {
        ANALYTIC = "analytic",
        CALCULATED = "calculated",
        ASSUMED = "assumed",
        BORROWED = "borrowed",
    }

    /**
     * - Table name: `measurement`
     * - Primary key: `(food_id, nutrient_id)`
     * - Indexes:
     *   - `(id)`
     */
    export type MeasurementTable = {
        /**
         * - SQL: `food_id bigint unsigned not null`
         * - Foreign key: `food.id`
         */
        food_id: BigIntString;
        /**
         * - SQL: `nutrient_id smallint unsigned not null`
         * - Foreign key: `nutrient.id`
         */
        nutrient_id: number;
        /**
         * - SQL: `id bigint unsigned unique not null auto_increment`
         */
        id: Generated<BigIntString>;
        /**
         * - SQL: `average decimal(10, 5) not null check (average >= 0)`
         */
        average: number;
        /**
         * - SQL: `deviation decimal(10, 5) check (deviation is null or deviation >= 0)`
         */
        deviation: number | null;
        /**
         * - SQL: `min decimal(10, 5) check (min is null or min >= 0)`
         */
        min: number | null;
        /**
         * - SQL: `max decimal(10, 5) check (max is null or max >= 0)`
         */
        max: number | null;
        /**
         * - SQL: `sample_size int check (sample_size is null or sample_size > 0)`
         */
        sample_size: number | null;
        /**
         * - SQL: `data_type enum("analytic", "calculated", "assumed", "borrowed") not null`
         */
        data_type: MeasurementDataType;
    };

    export type Measurement = Selectable<MeasurementTable>;
    export type NewMeasurement = Insertable<MeasurementTable>;
    export type MeasurementUpdate = Updateable<MeasurementTable>;

    /**
     * - Table name: `measurement_reference`
     * - Primary key: `(measurement_id, reference_code)`
     */
    export type MeasurementReferenceTable = {
        /**
         * - SQL: `measurement_id bigint unsigned not null`
         * - Foreign key: `measurement.id`
         */
        measurement_id: BigIntString;
        /**
         * - SQL: `reference_code int unsigned not null`
         * - Foreign key: `reference.code`
         */
        reference_code: number;
    };

    export type MeasurementReference = Selectable<MeasurementReferenceTable>;
    export type NewMeasurementReference = Insertable<MeasurementReferenceTable>;
    export type MeasurementReferenceUpdate = Updateable<MeasurementReferenceTable>;

    export enum MicronutrientType {
        VITAMIN = "vitamin",
        MINERAL = "mineral",
    }

    /**
     * - Table name: `micronutrient`
     * - Primary key: `(id)`
     */
    export type MicronutrientTable = {
        /**
         * - SQL: `id smallint unsigned primary key`
         * - Foreign key: `nutrient.id`
         */
        id: number;
        /**
         * - SQL: `type enum("vitamin", "mineral") not null`
         */
        type: MicronutrientType;
    };

    export type Micronutrient = Selectable<MicronutrientTable>;
    export type NewMicronutrient = Insertable<MicronutrientTable>;
    export type MicronutrientUpdate = Updateable<MicronutrientTable>;

    export enum NutrientType {
        ENERGY = "energy",
        MACRONUTRIENT = "macronutrient",
        COMPONENT = "component",
        MICRONUTRIENT = "micronutrient",
    }

    /**
     * - Table name: `nutrient`
     * - Primary key: `(id)`
     */
    export type NutrientTable = {
        /**
         * - SQL: `id smallint unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `type enum("energy", "macronutrient", "component", "micronutrient") not null`
         */
        type: NutrientType;
        /**
         * - SQL: `name varchar(32) not null check (name != "")`
         */
        name: string;
        /**
         * - SQL: `measurement_unit varchar(8) not null check (measurement_unit != "")`
         */
        measurement_unit: string;
        /**
         * - SQL: `standardized boolean not null default false`
         */
        standardized: Generated<boolean>;
        /**
         * - SQL: `note varchar(100) check (note is null or note != "")`
         */
        note: string | null;
    };

    export type Nutrient = Selectable<NutrientTable>;
    export type NewNutrient = Insertable<NutrientTable>;
    export type NutrientUpdate = Updateable<NutrientTable>;

    /**
     * - Table name: `nutrient_component`
     * - Primary key: `(id)`
     */
    export type NutrientComponentTable = {
        /**
         * - SQL: `id smallint unsigned primary key`
         * - Foreign key: `nutrient.id`
         */
        id: number;
        /**
         * - SQL: `macronutrient_id smallint unsigned not null`
         * - Foreign key: `nutrient.id`
         */
        macronutrient_id: number;
    };

    export type NutrientComponent = Selectable<NutrientComponentTable>;
    export type NewNutrientComponent = Insertable<NutrientComponentTable>;
    export type NutrientComponentUpdate = Updateable<NutrientComponentTable>;

    export enum OriginType {
        REGION = "region",
        PROVINCE = "province",
        COMMUNE = "commune",
        LOCATION = "location",
    }

    /**
     * - Table name: `origin`
     * - Primary key: `(id)`
     */
    export type OriginTable = {
        /**
         * - SQL: `id mediumint unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `type enum("region", "province", "commune", "location") not null`
         */
        type: OriginType;
        /**
         * - SQL: `name varchar(64) not null check (name != "")`
         */
        name: string;
    };

    export type Origin = Selectable<OriginTable>;
    export type NewOrigin = Insertable<OriginTable>;
    export type OriginUpdate = Updateable<OriginTable>;

    /**
     * - Table name: `province`
     * - Primary key: `(id)`
     */
    export type ProvinceTable = {
        /**
         * - SQL: `id mediumint unsigned primary key`
         * - Foreign key: `origin.id`
         */
        id: number;
        /**
         * - SQL: `region_id mediumint unsigned not null`
         * - Foreign key: `region.id`
         */
        region_id: number;
    };

    export type Province = Selectable<ProvinceTable>;
    export type NewProvince = Insertable<ProvinceTable>;
    export type ProvinceUpdate = Updateable<ProvinceTable>;

    /**
     * - Table name: `ref_author`
     * - Primary key: `(id)`
     * - Indexes:
     *   - `(name)`
     */
    export type RefAuthorTable = {
        /**
         * - SQL: `id int unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `name varchar(200) unique not null check (name != "")`
         */
        name: string;
    };

    export type RefAuthor = Selectable<RefAuthorTable>;
    export type NewRefAuthor = Insertable<RefAuthorTable>;
    export type RefAuthorUpdate = Updateable<RefAuthorTable>;

    /**
     * - Table name: `ref_city`
     * - Primary key: `(id)`
     * - Indexes:
     *   - `(name)`
     */
    export type RefCityTable = {
        /**
         * - SQL: `id int unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `name varchar(100) unique not null check (name != "")`
         */
        name: string;
    };

    export type RefCity = Selectable<RefCityTable>;
    export type NewRefCity = Insertable<RefCityTable>;
    export type RefCityUpdate = Updateable<RefCityTable>;

    /**
     * - Table name: `ref_article`
     * - Primary key: `(id)`
     */
    export type RefArticleTable = {
        /**
         * - SQL: `id int unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `volume_id int unsigned not null`
         * - Foreign key: `journal_volume.id`
         */
        volume_id: number;
        /**
         * - SQL: `page_start smallint unsigned not null`
         */
        page_start: number;
        /**
         * - SQL: `page_end smallint unsigned not null`
         */
        page_end: number;
    };

    export type RefArticle = Selectable<RefArticleTable>;
    export type NewRefArticle = Insertable<RefArticleTable>;
    export type RefArticleUpdate = Updateable<RefArticleTable>;

    export enum ReferenceType {
        REPORT = "report",
        THESIS = "thesis",
        ARTICLE = "article",
        WEBSITE = "website",
        BOOK = "book",
    }

    /**
     * - Table name: `reference`
     * - Primary key: `(code)`
     * - Indexes:
     *   - `(ref_article_id)`
     */
    export type ReferenceTable = {
        /**
         * - SQL: `code int unsigned primary key`
         */
        code: number;
        /**
         * - SQL: `title varchar(300) not null check (title != "")`
         */
        title: string;
        /**
         * - SQL: `type enum("report", "thesis", "article", "website", "book") not null`
         */
        type: ReferenceType;
        /**
         * - SQL: `ref_article_id int unsigned unique null`
         * - Foreign key: `ref_article.id`
         */
        ref_article_id: number | null;
        /**
         * - SQL: `ref_city_id int unsigned null`
         * - Foreign key: `ref_city.id`
         */
        ref_city_id: number | null;
        /**
         * - SQL: `year smallint unsigned`
         */
        year: number | null;
        /**
         * - SQL: `other varchar(100)`
         */
        other: string | null;
    };

    export type Reference = Selectable<ReferenceTable>;
    export type NewReference = Insertable<ReferenceTable>;
    export type ReferenceUpdate = Updateable<ReferenceTable>;

    /**
     * - Table name: `reference_author`
     * - Primary key: `(reference_code, author_id)`
     */
    export type ReferenceAuthorTable = {
        /**
         * - SQL: `reference_code int unsigned not null`
         * - Foreign key: `reference.code`
         */
        reference_code: number;
        /**
         * - SQL: `author_id int unsigned not null`
         * - Foreign key: `ref_author.id`
         */
        author_id: number;
    };

    export type ReferenceAuthor = Selectable<ReferenceAuthorTable>;
    export type NewReferenceAuthor = Insertable<ReferenceAuthorTable>;
    export type ReferenceAuthorUpdate = Updateable<ReferenceAuthorTable>;

    /**
     * - Table name: `region`
     * - Primary key: `(id)`
     * - Indexes:
     *   - `(number)`
     *   - `(place)`
     */
    export type RegionTable = {
        /**
         * - SQL: `id mediumint unsigned primary key`
         * - Foreign key: `origin.id`
         */
        id: number;
        /**
         * - SQL: `number tinyint unsigned unique not null check (number > 0)`
         */
        number: number;
        /**
         * - SQL: `place tinyint unsigned unique not null check (place >= 0)`
         */
        place: number;
    };

    export type Region = Selectable<RegionTable>;
    export type NewRegion = Insertable<RegionTable>;
    export type RegionUpdate = Updateable<RegionTable>;

    /**
     * - Table name: `scientific_name`
     * - Primary key: `(id)`
     * - Indexes:
     *   - `(name)`
     */
    export type ScientificNameTable = {
        /**
         * - SQL: `id int unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `name varchar(64) unique not null check (name != "")`
         */
        name: string;
    };

    export type ScientificName = Selectable<ScientificNameTable>;
    export type NewScientificName = Insertable<ScientificNameTable>;
    export type ScientificNameUpdate = Updateable<ScientificNameTable>;

    /**
     * - Table name: `subspecies`
     * - Primary key: `(id)`
     * - Indexes:
     *   - `(name)`
     */
    export type SubspeciesTable = {
        /**
         * - SQL: `id int unsigned primary key auto_increment`
         */
        id: Generated<number>;
        /**
         * - SQL: `name varchar(64) unique not null check (name != "")`
         */
        name: string;
    };

    export type Subspecies = Selectable<SubspeciesTable>;
    export type NewSubspecies = Insertable<SubspeciesTable>;
    export type SubspeciesUpdate = Updateable<SubspeciesTable>;

    export type Tables = {
        commune: CommuneTable;
        db_admin: DbAdminTable;
        food: FoodTable;
        food_group: FoodGroupTable;
        food_langual_code: FoodLangualCodeTable;
        food_origin: FoodOriginTable;
        food_translation: FoodTranslationTable;
        food_type: FoodTypeTable;
        journal: JournalTable;
        journal_volume: JournalVolumeTable;
        language: LanguageTable;
        langual_code: LangualCodeTable;
        location: LocationTable;
        measurement: MeasurementTable;
        measurement_reference: MeasurementReferenceTable;
        micronutrient: MicronutrientTable;
        nutrient: NutrientTable;
        nutrient_component: NutrientComponentTable;
        origin: OriginTable;
        province: ProvinceTable;
        ref_author: RefAuthorTable;
        ref_city: RefCityTable;
        ref_article: RefArticleTable;
        reference: ReferenceTable;
        reference_author: ReferenceAuthorTable;
        region: RegionTable;
        scientific_name: ScientificNameTable;
        subspecies: SubspeciesTable;
    };
}
