#!/bin/bash

# ZKPay SDK Examples 测试环境设置脚本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 ZKPay SDK Examples 测试环境设置${NC}"
echo ""

# 检查是否已有.env文件
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  发现现有.env文件${NC}"
    read -p "是否要覆盖现有配置? (y/N): " overwrite
    if [[ $overwrite != [yY] ]]; then
        echo "保持现有配置"
        exit 0
    fi
fi

echo -e "${BLUE}请选择私钥设置方式：${NC}"
echo "1. 使用新的测试私钥（推荐）"
echo "2. 输入现有私钥"
echo "3. 使用默认测试私钥（仅用于测试）"
echo ""

read -p "请选择 (1-3): " choice

case $choice in
    1)
        echo -e "${GREEN}生成新的测试私钥...${NC}"
        # 生成一个新的测试私钥
        NEW_PRIVATE_KEY=$(openssl rand -hex 32)
        echo "新生成的测试私钥: 0x$NEW_PRIVATE_KEY"
        echo -e "${YELLOW}⚠️  请保存此私钥，这是你的测试账户私钥${NC}"
        PRIVATE_KEY="0x$NEW_PRIVATE_KEY"
        ;;
    2)
        echo -e "${BLUE}请输入你的私钥：${NC}"
        read -p "私钥 (0x开头): " PRIVATE_KEY
        if [[ ! $PRIVATE_KEY =~ ^0x[0-9a-fA-F]{64}$ ]]; then
            echo -e "${RED}❌ 私钥格式错误，应该是64位十六进制字符${NC}"
            exit 1
        fi
        ;;
    3)
        echo -e "${YELLOW}⚠️  使用默认测试私钥（仅用于演示）${NC}"
        PRIVATE_KEY="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        ;;
    *)
        echo -e "${RED}❌ 无效选择${NC}"
        exit 1
        ;;
esac

# 创建.env文件
echo -e "${GREEN}创建.env文件...${NC}"
cat > .env << EOF
# ZKPay SDK Examples 测试配置
# 生成时间: $(date)

# 测试用户私钥
TEST_USER_PRIVATE_KEY=$PRIVATE_KEY

# 其他可选配置
# TEST_USER_ALT_PRIVATE_KEY=0x你的备用私钥
# SAFE_ADDRESS=0x你的安全地址
EOF

echo -e "${GREEN}✅ .env文件已创建${NC}"
echo ""

# 验证配置
echo -e "${BLUE}验证配置...${NC}"
if [ -f ".env" ]; then
    echo "✅ .env文件存在"
    if grep -q "TEST_USER_PRIVATE_KEY" .env; then
        echo "✅ TEST_USER_PRIVATE_KEY已设置"
    else
        echo -e "${RED}❌ TEST_USER_PRIVATE_KEY未设置${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ .env文件创建失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 测试环境设置完成！${NC}"
echo ""
echo -e "${BLUE}现在可以运行测试：${NC}"
echo "1. 快速验证测试:"
echo "   node quick-client-library-test.js --config config.yaml"
echo ""
echo "2. 完整示例测试:"
echo "   node zkpay-client-example.js --all"
echo ""
echo -e "${YELLOW}注意：${NC}"
echo "- 请确保测试账户有足够的BNB用于Gas费用"
echo "- 请确保测试账户有TestUSDT代币用于测试"
echo "- 私钥已保存在.env文件中，请妥善保管"
echo ""
echo -e "${BLUE}如需重新设置，请运行：${NC}"
echo "   ./setup-test-env.sh"


