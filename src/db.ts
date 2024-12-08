// noinspection JSUnusedGlobalSymbols

import { ColumnType, Insertable, Kysely, MysqlDialect, Selectable, Updateable } from "kysely";
import { createPool } from "mysql2";
import { Field, Next } from "mysql2/typings/mysql/lib/parsers/typeCast";
import logger from "./logger";

export default class Database extends Kysely<DB> {
    private static INSTANCE: Database | null = null;

    private constructor() {
        const {
            DATABASE_HOST,
            DATABASE_PORT,
            DATABASE_USERNAME,
            DATABASE_PASSWORD,
            DATABASE_NAME,
        } = process.env;

        super({
            log: ["query"],
            dialect: new MysqlDialect({
                pool: createPool({
                    host: DATABASE_HOST,
                    port: DATABASE_PORT ? +DATABASE_PORT : undefined,
                    user: DATABASE_USERNAME,
                    password: DATABASE_PASSWORD,
                    database: DATABASE_NAME,
                    supportBigNumbers: true,
                    bigNumberStrings: true,
                    dateStrings: true,
                    typeCast(field: Field, next: Next) {
                        if (field.type === "TINY" && field.length === 1) {
                            return field.string() === "1";
                        }
                        return next();
                    },
                }),
            }),
        });

        logger.log("Database connected.");
    }

    public static getInstance(): Database {
        Database.INSTANCE ??= new Database();
        return Database.INSTANCE;
    }
}

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;

export type Decimal<Nullable extends boolean = false> = Nullable extends false
    ? ColumnType<string, number | string | undefined, number | string | undefined>
    : ColumnType<string | null, number | string | null | undefined, number | string | null | undefined>;

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
    code: "es" | "en" | "pt";
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
    type: "city" | "town";
    /**
     * - SQL: `commune_id mediumint unsigned not null`
     * - Foreign key: `commune.id`
     */
    commune_id: number;
};

export type Location = Selectable<LocationTable>;
export type NewLocation = Insertable<LocationTable>;
export type LocationUpdate = Updateable<LocationTable>;

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
    average: Decimal;
    /**
     * - SQL: `deviation decimal(10, 5) check (deviation is null or deviation >= 0)`
     */
    deviation: Decimal<true>;
    /**
     * - SQL: `min decimal(10, 5) check (min is null or min >= 0)`
     */
    min: Decimal<true>;
    /**
     * - SQL: `max decimal(10, 5) check (max is null or max >= 0)`
     */
    max: Decimal<true>;
    /**
     * - SQL: `sample_size int check (sample_size is null or sample_size > 0)`
     */
    sample_size: number | null;
    /**
     * - SQL: `data_type enum("analytic", "calculated", "assumed", "borrowed") not null`
     */
    data_type: "analytic" | "calculated" | "assumed" | "borrowed";
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
    type: "vitamin" | "mineral";
};

export type Micronutrient = Selectable<MicronutrientTable>;
export type NewMicronutrient = Insertable<MicronutrientTable>;
export type MicronutrientUpdate = Updateable<MicronutrientTable>;

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
    type: "energy" | "macronutrient" | "component" | "micronutrient";
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
    type: "region" | "province" | "commune" | "location";
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
 * - Table name: `ref_volume`
 * - Primary key: `(id)`
 */
export type RefVolumeTable = {
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

export type RefVolume = Selectable<RefVolumeTable>;
export type NewRefVolume = Insertable<RefVolumeTable>;
export type RefVolumeUpdate = Updateable<RefVolumeTable>;

/**
 * - Table name: `reference`
 * - Primary key: `(code)`
 */
export type ReferenceTable = {
    /**
     * - SQL: `code int unsigned primary key auto_increment`
     */
    code: Generated<number>;
    /**
     * - SQL: `title varchar(300) not null check (title != "")`
     */
    title: string;
    /**
     * - SQL: `type enum("report", "thesis", "article", "website", "book") not null`
     */
    type: "report" | "thesis" | "article" | "website" | "book";
    /**
     * - SQL: `ref_volume_id int unsigned null`
     * - Foreign key: `ref_volume.id`
     */
    ref_volume_id: number | null;
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

export type DB = {
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
    ref_volume: RefVolumeTable;
    reference: ReferenceTable;
    reference_author: ReferenceAuthorTable;
    region: RegionTable;
    scientific_name: ScientificNameTable;
    subspecies: SubspeciesTable;
};
