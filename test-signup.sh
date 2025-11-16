#!/bin/bash

echo "🧪 Testing SkillSwap Signup Flow"
echo "================================="

# Test 1: Valid signup
echo "1. Testing valid signup..."
RESPONSE=$(curl -s -X POST http://localhost:8080/api/signup \
    -H "Content-Type: application/json" \
    -d '{"username":"newuser","email":"newuser@test.com","password":"Password123"}')

if [[ $RESPONSE == *"success"* ]]; then
    echo "✅ Valid signup working"
else
    echo "❌ Valid signup failed: $RESPONSE"
fi

# Test 2: Duplicate signup
echo "2. Testing duplicate signup..."
DUP_RESPONSE=$(curl -s -X POST http://localhost:8080/api/signup \
    -H "Content-Type: application/json" \
    -d '{"username":"newuser","email":"newuser@test.com","password":"Password123"}')

if [[ $DUP_RESPONSE == *"error"* ]] && [[ $DUP_RESPONSE == *"already exists"* ]]; then
    echo "✅ Duplicate validation working"
else
    echo "❌ Duplicate validation failed: $DUP_RESPONSE"
fi

# Test 3: Invalid email
echo "3. Testing invalid email..."
EMAIL_RESPONSE=$(curl -s -X POST http://localhost:8080/api/signup \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","email":"invalid-email","password":"Password123"}')

if [[ $EMAIL_RESPONSE == *"error"* ]] && [[ $EMAIL_RESPONSE == *"Invalid email"* ]]; then
    echo "✅ Email validation working"
else
    echo "❌ Email validation failed: $EMAIL_RESPONSE"
fi

# Test 4: Short username
echo "4. Testing short username..."
USER_RESPONSE=$(curl -s -X POST http://localhost:8080/api/signup \
    -H "Content-Type: application/json" \
    -d '{"username":"ab","email":"test@test.com","password":"Password123"}')

if [[ $USER_RESPONSE == *"error"* ]] && [[ $USER_RESPONSE == *"at least 3 characters"* ]]; then
    echo "✅ Username validation working"
else
    echo "❌ Username validation failed: $USER_RESPONSE"
fi

# Test 5: Short password
echo "5. Testing short password..."
PASS_RESPONSE=$(curl -s -X POST http://localhost:8080/api/signup \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","email":"test@test.com","password":"123"}')

if [[ $PASS_RESPONSE == *"error"* ]] && [[ $PASS_RESPONSE == *"at least 8 characters"* ]]; then
    echo "✅ Password validation working"
else
    echo "❌ Password validation failed: $PASS_RESPONSE"
fi

# Test 6: CORS
echo "6. Testing CORS..."
CORS_RESPONSE=$(curl -s -H "Origin: http://localhost:3000" \
    -X POST http://localhost:8080/api/signup \
    -H "Content-Type: application/json" \
    -d '{"username":"corsuser","email":"cors@test.com","password":"Password123"}')

if [[ $CORS_RESPONSE == *"success"* ]]; then
    echo "✅ CORS working"
else
    echo "❌ CORS failed: $CORS_RESPONSE"
fi

# Test 7: Login with new user
echo "7. Testing login with new user..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/login \
    -H "Content-Type: application/json" \
    -d '{"email":"newuser@test.com","password":"Password123"}')

if [[ $LOGIN_RESPONSE == *"user_id"* ]] && [[ $LOGIN_RESPONSE == *"username"* ]]; then
    echo "✅ Login working"
else
    echo "❌ Login failed: $LOGIN_RESPONSE"
fi

echo ""
echo "🎉 Signup flow tests completed!"
echo ""
echo "📋 Manual Testing Instructions:"
echo "1. Open http://localhost:3000/signup.html in your browser"
echo "2. Try creating an account with valid data"
echo "3. Try creating an account with invalid data"
echo "4. Verify error messages appear correctly"
echo "5. Verify successful signup redirects to login"
echo ""
echo "🔗 Test URLs:"
echo "- Signup: http://localhost:3000/signup.html"
echo "- Login: http://localhost:3000/login.html"
echo "- Backend API: http://localhost:8080/api"