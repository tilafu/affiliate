#!/bin/bash
# Database Schema Extraction Script for affiliate_db
# This script will extract the complete database schema including relations and fields

# Load environment variables
source .env

# Database connection parameters
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${DB_NAME:-affiliate_db}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_PORT="${DB_PORT:-5432}"

# Output file
SCHEMA_FILE="affiliate_db_schema.sql"
RELATIONS_FILE="affiliate_db_relations.sql"
COMPLETE_SCHEMA_FILE="affiliate_db_complete_schema.sql"

echo "Extracting database schema for $DB_NAME..."
echo "Output files: $SCHEMA_FILE, $RELATIONS_FILE, $COMPLETE_SCHEMA_FILE"

# 1. Extract complete schema with structure only (no data)
echo "-- Complete Database Schema for affiliate_db" > $COMPLETE_SCHEMA_FILE
echo "-- Generated on: $(date)" >> $COMPLETE_SCHEMA_FILE
echo "-- Database: $DB_NAME" >> $COMPLETE_SCHEMA_FILE
echo "" >> $COMPLETE_SCHEMA_FILE

pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only --no-owner --no-privileges >> $COMPLETE_SCHEMA_FILE

# 2. Extract table structures and relationships
echo "-- Table Structures and Relationships for affiliate_db" > $RELATIONS_FILE
echo "-- Generated on: $(date)" >> $RELATIONS_FILE
echo "" >> $RELATIONS_FILE

# Get all tables with their columns and types
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PRIMARY KEY'
        WHEN tc.constraint_type = 'FOREIGN KEY' THEN 'FOREIGN KEY -> ' || ccu.table_name || '(' || ccu.column_name || ')'
        WHEN tc.constraint_type = 'UNIQUE' THEN 'UNIQUE'
        ELSE ''
    END as constraint_info
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON c.table_name = t.table_name
LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.column_name = c.column_name AND ccu.table_name = t.table_name
LEFT JOIN information_schema.table_constraints tc ON tc.constraint_name = ccu.constraint_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;
" >> $RELATIONS_FILE

# 3. Extract foreign key relationships specifically
echo "" >> $RELATIONS_FILE
echo "-- Foreign Key Relationships" >> $RELATIONS_FILE
echo "" >> $RELATIONS_FILE

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    tc.table_name as source_table,
    kcu.column_name as source_column,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;
" >> $RELATIONS_FILE

# 4. Extract indexes
echo "" >> $RELATIONS_FILE
echo "-- Indexes" >> $RELATIONS_FILE
echo "" >> $RELATIONS_FILE

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
" >> $RELATIONS_FILE

echo "Schema extraction completed!"
echo "Files created:"
echo "  - $COMPLETE_SCHEMA_FILE (Complete schema with CREATE statements)"
echo "  - $RELATIONS_FILE (Detailed table relationships and structure)"
