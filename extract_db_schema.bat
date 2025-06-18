@echo off
REM Database Schema Extraction Script for affiliate_db (Windows)
REM This script will extract the complete database schema including relations and fields

echo Extracting database schema for affiliate_db...

REM Load environment variables from .env file
for /f "tokens=1,2 delims==" %%a in (.env) do (
    if "%%a"=="DB_USER" set DB_USER=%%b
    if "%%a"=="DB_HOST" set DB_HOST=%%b
    if "%%a"=="DB_NAME" set DB_NAME=%%b
    if "%%a"=="DB_PASSWORD" set DB_PASSWORD=%%b
    if "%%a"=="DB_PORT" set DB_PORT=%%b
)

REM Set defaults if not found
if "%DB_USER%"=="" set DB_USER=postgres
if "%DB_HOST%"=="" set DB_HOST=localhost
if "%DB_NAME%"=="" set DB_NAME=affiliate_db
if "%DB_PASSWORD%"=="" set DB_PASSWORD=postgres
if "%DB_PORT%"=="" set DB_PORT=5432

REM Output files
set SCHEMA_FILE=affiliate_db_schema.sql
set RELATIONS_FILE=affiliate_db_relations.sql
set COMPLETE_SCHEMA_FILE=affiliate_db_complete_schema.sql

echo Output files: %SCHEMA_FILE%, %RELATIONS_FILE%, %COMPLETE_SCHEMA_FILE%

REM 1. Extract complete schema with structure only (no data)
echo -- Complete Database Schema for affiliate_db > %COMPLETE_SCHEMA_FILE%
echo -- Generated on: %date% %time% >> %COMPLETE_SCHEMA_FILE%
echo -- Database: %DB_NAME% >> %COMPLETE_SCHEMA_FILE%
echo. >> %COMPLETE_SCHEMA_FILE%

pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --schema-only --no-owner --no-privileges >> %COMPLETE_SCHEMA_FILE%

REM 2. Extract table structures and relationships
echo -- Table Structures and Relationships for affiliate_db > %RELATIONS_FILE%
echo -- Generated on: %date% %time% >> %RELATIONS_FILE%
echo. >> %RELATIONS_FILE%

REM Set password for psql
set PGPASSWORD=%DB_PASSWORD%

REM Get all tables with their columns and types
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT t.table_name, c.column_name, c.data_type, c.character_maximum_length, c.is_nullable, c.column_default, CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PRIMARY KEY' WHEN tc.constraint_type = 'FOREIGN KEY' THEN 'FOREIGN KEY -> ' || ccu.table_name || '(' || ccu.column_name || ')' WHEN tc.constraint_type = 'UNIQUE' THEN 'UNIQUE' ELSE '' END as constraint_info FROM information_schema.tables t LEFT JOIN information_schema.columns c ON c.table_name = t.table_name LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.column_name = c.column_name AND ccu.table_name = t.table_name LEFT JOIN information_schema.table_constraints tc ON tc.constraint_name = ccu.constraint_name WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' ORDER BY t.table_name, c.ordinal_position;" >> %RELATIONS_FILE%

REM 3. Extract foreign key relationships specifically
echo. >> %RELATIONS_FILE%
echo -- Foreign Key Relationships >> %RELATIONS_FILE%
echo. >> %RELATIONS_FILE%

psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT tc.table_name as source_table, kcu.column_name as source_column, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, tc.constraint_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY' ORDER BY tc.table_name, kcu.column_name;" >> %RELATIONS_FILE%

REM 4. Extract indexes
echo. >> %RELATIONS_FILE%
echo -- Indexes >> %RELATIONS_FILE%
echo. >> %RELATIONS_FILE%

psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;" >> %RELATIONS_FILE%

echo Schema extraction completed!
echo Files created:
echo   - %COMPLETE_SCHEMA_FILE% (Complete schema with CREATE statements)
echo   - %RELATIONS_FILE% (Detailed table relationships and structure)

pause
