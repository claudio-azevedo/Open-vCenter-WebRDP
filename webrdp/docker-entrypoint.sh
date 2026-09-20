#!/bin/bash
set -e

# Deploy WAR to the correct context path based on WEBAPP_CONTEXT env var
# - ROOT -> / (root context)
# - webrdp -> /webrdp
# - any/path -> /any/path (using # encoding for subpaths)

CONTEXT="${WEBAPP_CONTEXT:-ROOT}"

# Convert slashes to # for Tomcat naming convention (e.g., "app/sub" -> "app#sub")
DEPLOY_NAME=$(echo "$CONTEXT" | sed 's|/|#|g')

echo "Deploying webrdp.war as context: /${CONTEXT} (filename: ${DEPLOY_NAME}.war)"

cp /usr/local/tomcat/webrdp.war "/usr/local/tomcat/webapps/${DEPLOY_NAME}.war"

# Execute the original command (catalina.sh run)
exec "$@"
