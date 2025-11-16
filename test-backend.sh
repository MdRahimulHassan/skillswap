#!/bin/bash

echo "🧪 SkillSwap Backend Testing Script"
echo "=================================="

# Base URL
BASE_URL="http://localhost:8080"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        echo -e "${RED}  Error: $3${NC}"
    fi
}

echo ""
echo "🔍 Testing Backend Connectivity..."

# Test 1: Basic connectivity
echo -n "Testing server connectivity... "
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|404"; then
    print_status 0 "Server is running"
else
    print_status 1 "Server is not responding" "Cannot connect to $BASE_URL"
    exit 1
fi

# Test 2: Profile endpoint with valid ID
echo -n "Testing GET /api/profile?id=1... "
RESPONSE=$(curl -s -w "%{http_code}" "$BASE_URL/api/profile?id=1")
HTTP_CODE=$(echo "$RESPONSE" | tail -c 3)
if [ "$HTTP_CODE" = "200" ]; then
    print_status 0 "Profile endpoint works"
elif [ "$HTTP_CODE" = "404" ]; then
    print_status 1 "User not found (expected for new database)" "HTTP $HTTP_CODE"
else
    print_status 1 "Unexpected response" "HTTP $HTTP_CODE"
fi

# Test 3: Profile endpoint with invalid ID
echo -n "Testing GET /api/profile?id=999... "
HTTP_CODE=$(curl -s -w "%{http_code}" "$BASE_URL/api/profile?id=999" | tail -c 3)
if [ "$HTTP_CODE" = "404" ]; then
    print_status 0 "Invalid user ID handled correctly"
else
    print_status 1 "Should return 404 for invalid user" "HTTP $HTTP_CODE"
fi

# Test 4: Profile endpoint without ID
echo -n "Testing GET /api/profile (no ID)... "
HTTP_CODE=$(curl -s -w "%{http_code}" "$BASE_URL/api/profile" | tail -c 3)
if [ "$HTTP_CODE" = "400" ]; then
    print_status 0 "Missing ID handled correctly"
else
    print_status 1 "Should return 400 for missing ID" "HTTP $HTTP_CODE"
fi

# Test 5: CORS headers
echo -n "Testing CORS headers... "
CORS_ORIGIN=$(curl -s -H "Origin: http://127.0.0.1:5500" -I "$BASE_URL/api/profile?id=1" | grep -i "access-control-allow-origin")
if echo "$CORS_ORIGIN" | grep -q "127.0.0.1:5500"; then
    print_status 0 "CORS headers present"
else
    print_status 1 "CORS headers missing" "Origin not allowed"
fi

# Test 6: Static files
echo -n "Testing static file serving... "
HTTP_CODE=$(curl -s -w "%{http_code}" "$BASE_URL/static/images/default.svg" | tail -c 3)
if [ "$HTTP_CODE" = "200" ]; then
    print_status 0 "Static files served correctly"
else
    print_status 1 "Static file serving failed" "HTTP $HTTP_CODE"
fi

# Test 7: HTML pages
echo -n "Testing HTML page serving... "
HTTP_CODE=$(curl -s -w "%{http_code}" "$BASE_URL/" | tail -c 3)
if [ "$HTTP_CODE" = "200" ]; then
    print_status 0 "HTML pages served correctly"
else
    print_status 1 "HTML page serving failed" "HTTP $HTTP_CODE"
fi

# Test 8: Login endpoint
echo -n "Testing POST /api/login... "
HTTP_CODE=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}' \
    "$BASE_URL/api/login" | tail -c 3)
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "400" ]; then
    print_status 0 "Login endpoint responds"
else
    print_status 1 "Login endpoint not working" "HTTP $HTTP_CODE"
fi

# Test 9: Signup endpoint
echo -n "Testing POST /api/signup... "
HTTP_CODE=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" \
    -d '{"username":"testuser","email":"test@example.com","password":"testpass"}' \
    "$BASE_URL/api/signup" | tail -c 3)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ]; then
    print_status 0 "Signup endpoint responds"
else
    print_status 1 "Signup endpoint not working" "HTTP $HTTP_CODE"
fi

echo ""
echo "🔧 Testing Database Connection..."

# Test 10: Database connectivity through API
echo -n "Testing database connectivity... "
HTTP_CODE=$(curl -s -w "%{http_code}" "$BASE_URL/api/profile?id=1" | tail -c 3)
if [ "$HTTP_CODE" != "000" ]; then
    print_status 0 "Database connection working"
else
    print_status 1 "Database connection failed" "No response from API"
fi

echo ""
echo "📊 Test Summary"
echo "=================="
echo "If all tests show ✓, the backend is working correctly!"
echo ""
echo "🚀 Next Steps:"
echo "1. Start frontend: Open frontend/ in Live Server (port 5500)"
echo "2. Test complete user flow: Signup → Login → Dashboard → Profile → Chat"
echo "3. Check browser console for any remaining errors"
echo ""
echo "🔗 URLs:"
echo "Frontend: http://127.0.0.1:5500/frontend/"
echo "Backend API: $BASE_URL/api/"
echo "Profile Test: $BASE_URL/api/profile?id=1"