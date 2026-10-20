import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import mysql, { Connection, RowDataPacket } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const FROZEN_MIGRATIONS_COUNT = 7;

interface DbConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

const dbConfig: DbConfig = {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USERNAME ?? 'root',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? 'food_comp_db',
};

interface TableSchemaInfo {
    columns: RowDataPacket[];
    constraints: RowDataPacket[];
}

interface TriggerInfo {
    event: string;
    table: string;
    timing: string;
    statement: string;
}

interface SchemaSnapshot {
    tables: Record<string, TableSchemaInfo>;
    triggers: Record<string, TriggerInfo>;
}

interface DetailedDiff {
    category: 'TABLES' | 'COLUMNS' | 'CONSTRAINTS' | 'TRIGGERS';
    target: string;
    detail: string;
}

function runCommand(command: string): string {
    try {
        return execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
    } catch (error: unknown) {
        console.error(`\nError ejecutando comando: "${command}"`);
        if (error && typeof error === 'object' && 'stdout' in error) {
            const execErr = error as { stdout?: Buffer | string; stderr?: Buffer | string };
            if (execErr.stdout) console.error(execErr.stdout.toString());
            if (execErr.stderr) console.error(execErr.stderr.toString());
        }
        throw error;
    }
}

async function getDatabaseConnection(): Promise<Connection> {
    return await mysql.createConnection(dbConfig);
}

function getMigrationFiles(): string[] {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir);
    return files
        .filter((f) => f.endsWith('.js'))
        .sort((a, b) => a.localeCompare(b));
}

async function getSchemaSnapshot(connection: Connection): Promise<SchemaSnapshot> {
    const [tables] = await connection.query<RowDataPacket[]>(
        `SELECT TABLE_NAME
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ?
           AND TABLE_TYPE = 'BASE TABLE'
           AND TABLE_NAME != 'migrations'
         ORDER BY TABLE_NAME`,
        [dbConfig.database]
    );

    const snapshot: SchemaSnapshot = {
        tables: {},
        triggers: {},
    };

    for (const row of tables) {
        const tableName = row.TABLE_NAME as string;

        const [columns] = await connection.query<RowDataPacket[]>(
            `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
             ORDER BY COLUMN_NAME`,
            [dbConfig.database, tableName]
        );

        const [constraints] = await connection.query<RowDataPacket[]>(
            `SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE
             FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE != 'CHECK'
             ORDER BY CONSTRAINT_NAME`,
            [dbConfig.database, tableName]
        );

        snapshot.tables[tableName] = {
            columns,
            constraints,
        };
    }

    const [triggers] = await connection.query<RowDataPacket[]>(
        `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING, ACTION_STATEMENT
         FROM information_schema.TRIGGERS
         WHERE TRIGGER_SCHEMA = ?
         ORDER BY TRIGGER_NAME`,
        [dbConfig.database]
    );

    for (const trig of triggers) {
        const triggerName = trig.TRIGGER_NAME as string;
        const actionStmt = trig.ACTION_STATEMENT as string;

        snapshot.triggers[triggerName] = {
            event: trig.EVENT_MANIPULATION as string,
            table: trig.EVENT_OBJECT_TABLE as string,
            timing: trig.ACTION_TIMING as string,
            statement: actionStmt.replace(/\s+/g, ' ').trim(),
        };
    }

    return snapshot;
}

function compareSnapshots(snapBefore: SchemaSnapshot, snapAfter: SchemaSnapshot): DetailedDiff[] {
    const diffs: DetailedDiff[] = [];

    const tablesBefore = Object.keys(snapBefore.tables).sort();
    const tablesAfter = Object.keys(snapAfter.tables).sort();

    const missingTables = tablesBefore.filter((t) => !tablesAfter.includes(t));
    const addedTables = tablesAfter.filter((t) => !tablesBefore.includes(t));

    missingTables.forEach((t) => {
        diffs.push({
            category: 'TABLES',
            target: `Tabla '${t}'`,
            detail: 'La tabla existia en el estado previo pero NO fue recreada tras el DOWN.',
        });
    });

    addedTables.forEach((t) => {
        diffs.push({
            category: 'TABLES',
            target: `Tabla '${t}'`,
            detail: 'La tabla NO existia en el estado previo pero quedo huerfana tras el DOWN.',
        });
    });

    const commonTables = tablesBefore.filter((t) => tablesAfter.includes(t));

    for (const table of commonTables) {
        const tBefore = snapBefore.tables[table];
        const tAfter = snapAfter.tables[table];

        if (!tBefore || !tAfter) continue;

        const colsBeforeMap = new Map(tBefore.columns.map((c) => [c.COLUMN_NAME as string, c]));
        const colsAfterMap = new Map(tAfter.columns.map((c) => [c.COLUMN_NAME as string, c]));

        for (const colName of colsBeforeMap.keys()) {
            if (!colsAfterMap.has(colName)) {
                diffs.push({
                    category: 'COLUMNS',
                    target: `Tabla '${table}' -> Columna '${colName}'`,
                    detail: 'Columna eliminada o no recuperada tras el DOWN.',
                });
            }
        }

        for (const colName of colsAfterMap.keys()) {
            if (!colsBeforeMap.has(colName)) {
                diffs.push({
                    category: 'COLUMNS',
                    target: `Tabla '${table}' -> Columna '${colName}'`,
                    detail: 'Columna extra agregada que no existia antes del UP.',
                });
            }
        }

        for (const [colName, colB] of colsBeforeMap.entries()) {
            const colA = colsAfterMap.get(colName);
            if (colA && JSON.stringify(colB) !== JSON.stringify(colA)) {
                diffs.push({
                    category: 'COLUMNS',
                    target: `Tabla '${table}' -> Columna '${colName}'`,
                    detail: `Propiedades modificadas.\n      Anterior: ${JSON.stringify(colB)}\n      Actual:   ${JSON.stringify(colA)}`,
                });
            }
        }

        const constBeforeMap = new Map(tBefore.constraints.map((c) => [c.CONSTRAINT_NAME as string, c]));
        const constAfterMap = new Map(tAfter.constraints.map((c) => [c.CONSTRAINT_NAME as string, c]));

        for (const constName of constBeforeMap.keys()) {
            if (!constAfterMap.has(constName)) {
                diffs.push({
                    category: 'CONSTRAINTS',
                    target: `Tabla '${table}' -> Constraint '${constName}'`,
                    detail: 'Restriccion / Clave Foranea faltante tras el DOWN.',
                });
            }
        }

        for (const constName of constAfterMap.keys()) {
            if (!constBeforeMap.has(constName)) {
                diffs.push({
                    category: 'CONSTRAINTS',
                    target: `Tabla '${table}' -> Constraint '${constName}'`,
                    detail: 'Restriccion / Clave Foranea extra no eliminada tras el DOWN.',
                });
            }
        }
    }

    const trigBeforeKeys = Object.keys(snapBefore.triggers);
    const trigAfterKeys = Object.keys(snapAfter.triggers);

    const missingTriggers = trigBeforeKeys.filter((tr) => !trigAfterKeys.includes(tr));
    const addedTriggers = trigAfterKeys.filter((tr) => !trigBeforeKeys.includes(tr));

    missingTriggers.forEach((tr) => {
        diffs.push({
            category: 'TRIGGERS',
            target: `Trigger '${tr}'`,
            detail: 'El trigger existia antes de la migracion pero no fue recreado en el DOWN.',
        });
    });

    addedTriggers.forEach((tr) => {
        diffs.push({
            category: 'TRIGGERS',
            target: `Trigger '${tr}'`,
            detail: 'El trigger fue creado en el UP pero no fue eliminado en el DOWN.',
        });
    });

    const commonTriggers = trigBeforeKeys.filter((tr) => trigAfterKeys.includes(tr));
    for (const tr of commonTriggers) {
        const trBefore = snapBefore.triggers[tr];
        const trAfter = snapAfter.triggers[tr];

        if (trBefore && trAfter && JSON.stringify(trBefore) !== JSON.stringify(trAfter)) {
            diffs.push({
                category: 'TRIGGERS',
                target: `Trigger '${tr}'`,
                detail: `Definicion o cuerpo del trigger modificado.\n      Anterior: ${JSON.stringify(trBefore)}\n      Actual:   ${JSON.stringify(trAfter)}`,
            });
        }
    }

    return diffs;
}

async function verifySymmetry(): Promise<void> {
    const migrations = getMigrationFiles();
    console.log(`\nIniciando verificacion de simetria sobre ${migrations.length} migraciones...`);
    console.log(`Omite verificacion UP/DOWN en las primeras ${FROZEN_MIGRATIONS_COUNT} migraciones.\n`);

    for (let i = FROZEN_MIGRATIONS_COUNT; i < migrations.length; i++) {
        const currentMigration = migrations[i];
        console.log(`--------------------------------------------------`);
        console.log(`Verificando Migracion [${i + 1}/${migrations.length}]: ${currentMigration}`);

        runCommand('npm run db:delete');

        for (let j = 0; j < i; j++) {
            runCommand('npm run migrate:up:next');
        }

        let connection = await getDatabaseConnection();
        const snapshotBefore = await getSchemaSnapshot(connection);
        await connection.end();

        runCommand('npm run migrate:up:next');
        runCommand('npm run migrate:down:next');

        connection = await getDatabaseConnection();
        const snapshotAfter = await getSchemaSnapshot(connection);
        await connection.end();

        const differences = compareSnapshots(snapshotBefore, snapshotAfter);

        if (differences.length > 0) {
            console.error(`\nFALLO DE SIMETRIA EN LA MIGRACION: ${currentMigration}`);
            console.error(`Se encontraron ${differences.length} desalineaciones entre el estado inicial y el posterior al DOWN:\n`);

            differences.forEach((diff, idx) => {
                console.error(`  ${idx + 1}. [${diff.category}] ${diff.target}`);
                console.error(`     └─ Detalle: ${diff.detail}\n`);
            });

            process.exit(1);
        }

        console.log(`Simetria OK para: ${currentMigration}`);
    }

    runCommand('npm run db:delete');
    console.log(`\nTodas las migraciones evaluables tienen simetria UP/DOWN perfecta.\n`);
}

verifySymmetry().catch((_err: unknown) => {
    console.error('\nProceso de verificacion abortado con error.');
    process.exit(1);
});
