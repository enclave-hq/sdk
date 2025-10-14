#!/bin/bash

# ZKPay SDK Examples Test Environment Setup Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 ZKPay SDK Examples Test Environment Setup${NC}"
echo ""

# Check if .env file already exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Found existing .env file${NC}"
    read -p "Do you want to overwrite existing configuration? (y/N): " overwrite
    if [[ $overwrite != [yY] ]]; then
        echo "Keeping existing configuration"
        exit 0
    fi
fi

echo -e "${BLUE}Please select private key setup method:${NC}"
echo "1. Use new test private key (recommended)"
echo "2. Enter existing private key"
echo "3. Use default test private key (for testing only)"
echo ""

read -p "Please select (1-3): " choice

case $choice in
    1)
        echo -e "${GREEN}Generating new test private key...${NC}"
        # Generate a new test private key
        NEW_PRIVATE_KEY=$(openssl rand -hex 32)
        echo "New generated test private key: 0x$NEW_PRIVATE_KEY"
        echo -e "${YELLOW}⚠️  Please save this private key, this is your test account private key${NC}"
        PRIVATE_KEY="0x$NEW_PRIVATE_KEY"
        ;;
    2)
        echo -e "${BLUE}Please enter your private key:${NC}"
        read -p "Private key (starts with 0x): " PRIVATE_KEY
        if [[ ! $PRIVATE_KEY =~ ^0x[0-9a-fA-F]{64}$ ]]; then
            echo -e "${RED}❌ Private key format error, should be 64-bit hexadecimal Characters${NC}"
            exit 1
        fi
        ;;
    3)
        echo -e "${YELLOW}⚠️  UseDefault测试Private Key（Only forDemo）${NC}"
        PRIVATE_KEY="your_private_key"
        ;;
    *)
        echo -e "${RED}❌ 无效Select${NC}"
        exit 1
        ;;
esac

# Create.envFile
echo -e "${GREEN}Create.envFile...${NC}"
cat > .env << EOF
# ZKPay SDK Examples 测试Configuration
# 生成时间: $(date)

# 测试UserPrivate Key
TEST_USER_PRIVATE_KEY=$PRIVATE_KEY

# 其他可选Configuration
# TEST_USER_ALT_PRIVATE_KEY=0xYour备用Private Key
# SAFE_ADDRESS=0xYourSecurityAddress
EOF

echo -e "${GREEN}✅ .envFile已Create${NC}"
echo ""

# 验证Configuration
echo -e "${BLUE}验证Configuration...${NC}"
if [ -f ".env" ]; then
    echo "✅ .envFile存在"
    if grep -q "TEST_USER_PRIVATE_KEY" .env; then
        echo "✅ TEST_USER_PRIVATE_KEY已设置"
    else
        echo -e "${RED}❌ TEST_USER_PRIVATE_KEY未设置${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ .envFileCreate失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 测试Environment设置完成！${NC}"
echo ""
echo -e "${BLUE}现在可以Run测试：${NC}"
echo "1. 快速验证测试:"
echo "   node quick-client-library-test.js --config config.yaml"
echo ""
echo "2. 完整示例测试:"
echo "   node zkpay-client-example.js --all"
echo ""
echo -e "${YELLOW}注意：${NC}"
echo "- Please确保测试Account有足够的BNB用于Gas费用"
echo "- Please确保测试Account有TestUSDT代币用于测试"
echo "- Private KeySaved在.envFile中，Please妥善保管"
echo ""
echo -e "${BLUE}如需重新设置，PleaseRun：${NC}"
echo "   ./setup-test-env.sh"
