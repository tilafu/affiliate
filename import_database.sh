#!/bin/bash
# Import PostgreSQL database from SQL file
# Save this on your Ubuntu server as /tmp/import_database.sh

# Configuration variables - modify these as needed
DB_NAME="affiliate_db"
DB_USER="postgres"  # Change if using a different database user
IMPORT_FILE="/tmp/affiliate_db_export.sql"

echo "==== PostgreSQL Database Import Script ===="
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Import file: $IMPORT_FILE"
echo "======================================="

# Check if the import file exists
if [ ! -f "$IMPORT_FILE" ]; then
    echo "Error: Import file not found at $IMPORT_FILE"
    echo "Did you upload the file to the correct location?"
    exit 1
fi

# Check if unzip is needed
if [[ "$IMPORT_FILE" == *.zip ]]; then
    echo "Detected ZIP file. Extracting..."
    unzip -o "$IMPORT_FILE" -d /tmp
    IMPORT_FILE="/tmp/affiliate_db_export.sql"
    echo "Extracted to: $IMPORT_FILE"
fi

# Check if the database exists
echo "Checking if database $DB_NAME exists..."
DB_EXISTS=$(psql -U $DB_USER -lqt | cut -d \| -f 1 | grep -w $DB_NAME | wc -l)

if [ "$DB_EXISTS" -eq "0" ]; then
    echo "Database $DB_NAME does not exist. Creating..."
    createdb -U $DB_USER $DB_NAME
    if [ $? -ne 0 ]; then
        echo "Error: Failed to create database $DB_NAME"
        exit 1
    fi
    echo "Database created successfully."
else
    echo "Database $DB_NAME already exists."
    
    # Ask for confirmation before proceeding
    read -p "Do you want to drop and recreate the database? This will delete all existing data! (y/n): " CONFIRM
    if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
        echo "Dropping database $DB_NAME..."
        dropdb -U $DB_USER $DB_NAME
        if [ $? -ne 0 ]; then
            echo "Error: Failed to drop database $DB_NAME"
            exit 1
        fi
        
        echo "Creating database $DB_NAME..."
        createdb -U $DB_USER $DB_NAME
        if [ $? -ne 0 ]; then
            echo "Error: Failed to create database $DB_NAME"
            exit 1
        fi
    fi
fi

# Import the database
echo "Importing database from $IMPORT_FILE..."
psql -U $DB_USER -d $DB_NAME -f $IMPORT_FILE

if [ $? -eq 0 ]; then
    echo "Database import completed successfully!"
else
    echo "Error: Database import failed."
    exit 1
fi

echo "======================================="
echo "Database import process is complete."
echo "You can now connect to your database and verify the import."
