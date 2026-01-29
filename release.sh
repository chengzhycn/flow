#!/bin/bash

if [ -z "$1" ]; then
  echo "Please provide a version number (e.g. 0.3.0)"
  exit 1
fi

VERSION=$1

# Update package.json
echo "Updating package.json..."
npm version $VERSION --no-git-tag-version

# Update tauri.conf.json
echo "Updating tauri.conf.json..."
node -e "
const fs = require('fs');
const path = 'src-tauri/tauri.conf.json';
const content = fs.readFileSync(path, 'utf8');
const json = JSON.parse(content);
json.version = '$VERSION';
fs.writeFileSync(path, JSON.stringify(json, null, 2));
"

# Update Cargo.toml
echo "Updating Cargo.toml..."
# Update the version in the [package] section
# This simple sed works assuming 'version =' is at the start of the line for the package version
sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

# Git commit and tag
echo "Committing and tagging..."
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore(release): v$VERSION"
git tag "v$VERSION"

echo "-------------------------------------------------------"
echo "Release v$VERSION created successfully!"
echo "Run the following command to push the changes and tag:"
echo "git push && git push --tags"
echo "-------------------------------------------------------"
