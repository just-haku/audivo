import os
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")
CACHE_DIR = os.path.join(BASE_DIR, "backend", "cache")

subdirs = [
    os.path.join(DOWNLOADS_DIR, "videos"),
    os.path.join(DOWNLOADS_DIR, "music"),
    os.path.join(DOWNLOADS_DIR, "subtitles"),
    os.path.join(DOWNLOADS_DIR, "generated"),
    os.path.join(DOWNLOADS_DIR, "fonts"),
    os.path.join(DOWNLOADS_DIR, "templates", "intros"),
    os.path.join(DOWNLOADS_DIR, "templates", "outros"),
    CACHE_DIR
]

print("--- Starting Wiping Process ---")

# Wipe files in subdirectories
for folder in subdirs:
    if os.path.exists(folder):
        print(f"Cleaning folder: {folder}")
        for filename in os.listdir(folder):
            file_path = os.path.join(folder, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
                print(f"  Deleted: {filename}")
            except Exception as e:
                print(f"  Failed to delete {filename}. Reason: {e}")

# Delete DB files
db_files = [
    os.path.join(DOWNLOADS_DIR, "media.db"),
    os.path.join(DOWNLOADS_DIR, "jobs.db")
]

for db in db_files:
    if os.path.exists(db):
        try:
            os.remove(db)
            print(f"Removed database: {os.path.basename(db)}")
        except Exception as e:
            print(f"Failed to delete database {os.path.basename(db)}. Reason: {e}")

print("Clean wipe completed successfully!")
