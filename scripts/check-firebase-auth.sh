#!/bin/bash
# Firebase Auth Diagnostics Script

echo "=== Firebase Authentication Diagnostics ==="
echo ""
echo "Project: instacal-app"
echo "Date: $(date)"
echo ""

echo "1. Checking gcloud authentication..."
gcloud auth list --filter=status:ACTIVE --format="value(account)"
echo ""

echo "2. Current gcloud project..."
gcloud config get-value project
echo ""

echo "3. Checking Firebase services..."
gcloud services list --enabled --filter="name:identitytoolkit OR name:firebase" --format="value(name)" --project=instacal-app
echo ""

echo "4. Checking Identity Platform config..."
gcloud identity platforms configs describe --format="json" --project=instacal-app 2>/dev/null || echo "Unable to fetch config (this is expected)"
echo ""

echo "5. Recent Firebase Auth errors (last 1 hour)..."
gcloud logging read "resource.type=audited_resource AND protoPayload.serviceName=identitytoolkit.googleapis.com AND severity>=ERROR" \
  --limit=10 \
  --freshness=1h \
  --format="table(timestamp,severity,protoPayload.status.message)" \
  --project=instacal-app 2>/dev/null || echo "No recent errors found"
echo ""

echo "6. All Identity Toolkit activity (last 30 minutes)..."
gcloud logging read "protoPayload.serviceName=identitytoolkit.googleapis.com" \
  --limit=20 \
  --freshness=30m \
  --format="table(timestamp,protoPayload.methodName,protoPayload.status.code)" \
  --project=instacal-app 2>/dev/null || echo "No recent activity"
echo ""

echo "=== Next Steps ==="
echo "1. Open browser console (F12)"
echo "2. Try signing in"
echo "3. Check for [SignIn] logs in browser console"
echo "4. Visit: https://console.firebase.google.com/project/instacal-app/authentication/providers"
echo ""
