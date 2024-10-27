import { ColumnType, Kysely, MysqlDialect } from "kysely";
import { createPool } from "mysql2";
import logger from "./logger";

let connected = false;

export let db: Kysely<DB>;

// `db` can't be overwritten outside of this file
// deferred initialization, must wait for env variables to be ready

export function connectDB(): void {
    if (connected) return;

    const {
        DB_HOST,
        DB_PORT,
        DB_USERNAME,
        DB_PASSWORD,
        DB_NAME,
    } = process.env;

    db = new Kysely<DB>({
        dialect: new MysqlDialect({
            pool: createPool({
                host: DB_HOST,
                port: DB_PORT ? +DB_PORT : undefined,
                user: DB_USERNAME,
                password: DB_PASSWORD,
                database: DB_NAME,
                supportBigNumbers: true,
                bigNumberStrings: true,
                dateStrings: true,
            }),
        }),
    });

    connected = true;

    logger.log("Database connected.");
}

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;

/**
 * String representation of a 64-bit integer.
 */
type BigIntString = `${number}`;

/**
 * - Table name: `commune`
 * - Primary key: `(id)`
 */
export type Commune = {
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

/**
 * - Table name: `food`
 * - Primary key: `(id)`
 * - Indexes:
 *   - `(code)`
 */
export type Food = {
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
     * - SQL: `strain varchar(50) check (strain = null or strain != "")`
     */
    strain: string | null;
    /**
     * - SQL: `brand varchar(8) check (brand = null or brand != "")`
     */
    brand: string | null;
    /**
     * - SQL: `observation varchar(100) check (observation = null or observation != "")`
     */
    observation: string | null;
};

/**
 * - Table name: `food_group`
 * - Primary key: `(id)`
 * - Indexes:
 *   - `(code)`
 */
export type FoodGroup = {
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

/**
 * - Table name: `food_langual_code`
 * - Primary key: `(food_id, langual_id)`
 */
export type FoodLangualCode = {
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

/**
 * - Table name: `food_origin`
 * - Primary key: `(food_id, origin_id)`
 */
export type FoodOrigin = {
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

/**
 * - Table name: `food_translation`
 * - Primary key: `(food_id, language_id)`
 */
export type FoodTranslation = {
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
};

/**
 * - Table name: `food_type`
 * - Primary key: `(id)`
 * - Indexes:
 *   - `(code)`
 */
export type FoodType = {
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

/**
 * - Table name: `journal`
 * - Primary key: `(id)`
 */
export type Journal = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
    /**
     * - SQL: `name varchar(50) not null check (name != "")`
     */
    name: string;
};

/**
 * - Table name: `journal_volume`
 * - Primary key: `(id)`
 */
export type JournalVolume = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
    /**
     * - SQL: `id_journal int unsigned not null`
     * - Foreign key: `journal.id`
     */
    id_journal: number;
    /**
     * - SQL: `volume int unsigned not null`
     */
    volume: number;
    /**
     * - SQL: `issue int unsigned`
     */
    issue: number | null;
    /**
     * - SQL: `year smallint unsigned not null`
     */
    year: number;
};

/**
 * - Table name: `language`
 * - Primary key: `(id)`
 * - Indexes:
 *   - `(code)`
 */
export type Language = {
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

/**
 * - Table name: `langual_code`
 * - Primary key: `(id)`
 * - Indexes:
 *   - `(code)`
 */
export type LangualCode = {
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

/**
 * - Table name: `location`
 * - Primary key: `(id)`
 */
export type Location = {
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

/**
 * - Table name: `measurement`
 * - Primary key: `(food_id, nutrient_id)`
 * - Indexes:
 *   - `(id)`
 */
export type Measurement = {
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
     * - SQL: `average float not null check (average >= 0)`
     */
    average: number;
    /**
     * - SQL: `deviation float check (deviation = null or deviation >= 0)`
     */
    deviation: number | null;
    /**
     * - SQL: `min float check (min = null or min >= 0)`
     */
    min: number | null;
    /**
     * - SQL: `max float check (max = null or max >= 0)`
     */
    max: number | null;
    /**
     * - SQL: `sample_size int check (sample_size = null or sample_size > 0)`
     */
    sample_size: number | null;
    /**
     * - SQL: `data_type enum("analytic", "calculated", "assumed") not null`
     */
    data_type: "analytic" | "calculated" | "assumed";
};

/**
 * - Table name: `measurement_references`
 * - Primary key: `(measurement_id, reference_code)`
 */
export type MeasurementReferences = {
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

/**
 * - Table name: `micronutrient`
 * - Primary key: `(id)`
 */
export type Micronutrient = {
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

/**
 * - Table name: `nutrient`
 * - Primary key: `(id)`
 */
export type Nutrient = {
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
     * - SQL: `note varchar(100) check (note = null or note != "")`
     */
    note: string | null;
};

/**
 * - Table name: `nutrient_component`
 * - Primary key: `(id)`
 */
export type NutrientComponent = {
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

/**
 * - Table name: `origin`
 * - Primary key: `(id)`
 */
export type Origin = {
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

/**
 * - Table name: `province`
 * - Primary key: `(id)`
 */
export type Province = {
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

/**
 * - Table name: `ref_author`
 * - Primary key: `(id)`
 */
export type RefAuthor = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
    /**
     * - SQL: `name varchar(50) not null check (name != "")`
     */
    name: string;
};

/**
 * - Table name: `ref_city`
 * - Primary key: `(id)`
 */
export type RefCity = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
    /**
     * - SQL: `name varchar(50) not null check (name != "")`
     */
    name: string;
};

/**
 * - Table name: `ref_volume`
 * - Primary key: `(id)`
 */
export type RefVolume = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
    /**
     * - SQL: `id_volume int unsigned not null`
     * - Foreign key: `journal_volume.id`
     */
    id_volume: number;
    /**
     * - SQL: `page_start smallint unsigned not null`
     */
    page_start: number;
    /**
     * - SQL: `page_end smallint unsigned not null`
     */
    page_end: number;
};

/**
 * - Table name: `reference`
 * - Primary key: `(code)`
 */
export type Reference = {
    /**
     * - SQL: `code int unsigned primary key auto_increment`
     */
    code: Generated<number>;
    /**
     * - SQL: `title varchar(100) not null check (title != "")`
     */
    title: string;
    /**
     * - SQL: `type enum("report", "thesis", "article", "website") not null`
     */
    type: "report" | "thesis" | "article" | "website";
    /**
     * - SQL: `measurement_id bigint unsigned not null`
     * - Foreign key: `measurement.id`
     */
    measurement_id: BigIntString;
    /**
     * - SQL: `ref_author_id int unsigned not null`
     * - Foreign key: `ref_author.id`
     */
    ref_author_id: number;
    /**
     * - SQL: `ref_volume_id int unsigned`
     * - Foreign key: `ref_volume.id`
     */
    ref_volume_id: number | null;
    /**
     * - SQL: `ref_city_id int unsigned`
     * - Foreign key: `ref_city.id`
     */
    ref_city_id: number | null;
    /**
     * - SQL: `year smallint unsigned`
     */
    year: number | null;
    /**
     * - SQL: `other varchar(50)`
     */
    other: string | null;
};

/**
 * - Table name: `region`
 * - Primary key: `(id)`
 */
export type Region = {
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

/**
 * - Table name: `scientific_name`
 * - Primary key: `(id)`
 */
export type ScientificName = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
    /**
     * - SQL: `name varchar(64) unique not null check (name != "")`
     */
    name: string;
};

/**
 * - Table name: `subspecies`
 * - Primary key: `(id)`
 */
export type Subspecies = {
    /**
     * - SQL: `id int unsigned primary key auto_increment`
     */
    id: Generated<number>;
    /**
     * - SQL: `name varchar(64) unique not null check (name != "")`
     */
    name: string;
};

export type DB = {
    commune: Commune;
    food: Food;
    food_group: FoodGroup;
    food_langual_code: FoodLangualCode;
    food_origin: FoodOrigin;
    food_translation: FoodTranslation;
    food_type: FoodType;
    journal: Journal;
    journal_volume: JournalVolume;
    language: Language;
    langual_code: LangualCode;
    location: Location;
    measurement: Measurement;
    measurement_references: MeasurementReferences;
    micronutrient: Micronutrient;
    nutrient: Nutrient;
    nutrient_component: NutrientComponent;
    origin: Origin;
    province: Province;
    ref_author: RefAuthor;
    ref_city: RefCity;
    ref_volume: RefVolume;
    reference: Reference;
    region: Region;
    scientific_name: ScientificName;
    subspecies: Subspecies;
};
