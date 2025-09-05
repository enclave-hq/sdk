#!/bin/bash

# ZKPay Client Library 测试运行脚本
# 用于运行基于client-library的E2E测试

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印函数
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# 检查环境
check_environment() {
    print_header "环境检查"
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        exit 1
    fi
    print_success "Node.js: $(node --version)"
    
    # 检查是否在正确目录
    if [[ ! -f "package.json" ]] || [[ ! -d "zkpay-client-library" ]]; then
        print_error "请在e2e-automation目录中运行此脚本"
        exit 1
    fi
    print_success "目录检查通过"
    
    # 检查配置文件
    if [[ ! -f "config.yaml" ]]; then
        print_error "未找到config.yaml配置文件"
        exit 1
    fi
    print_success "配置文件存在"
    
    # 检查client library
    if [[ ! -f "zkpay-client-library/index.js" ]]; then
        print_error "ZKPay Client Library 未找到"
        exit 1
    fi
    print_success "ZKPay Client Library 存在"
}

# 安装依赖
install_dependencies() {
    print_header "安装依赖"
    
    print_info "安装主项目依赖..."
    npm install --silent
    
    print_info "安装Client Library依赖..."
    cd zkpay-client-library
    npm install --silent
    cd ..
    
    print_success "依赖安装完成"
}

# 清理环境
cleanup_environment() {
    print_header "清理测试环境"
    
    # 清理日志文件
    print_info "清理旧日志文件..."
    rm -f e2e-test.log
    rm -f zkpay-client-library/e2e-test.log
    rm -f zkpay-client-library/exceptions.log
    rm -f zkpay-client-library/rejections.log
    rm -f client-library-test-results-*.json
    
    print_success "环境清理完成"
}

# 运行快速验证
run_quick_test() {
    print_header "快速验证测试"
    
    print_info "运行Client Library快速验证..."
    node quick-client-library-test.js --config config.yaml
    
    if [ $? -eq 0 ]; then
        print_success "快速验证通过"
        return 0
    else
        print_error "快速验证失败"
        return 1
    fi
}

# 运行完整测试
run_full_test() {
    print_header "完整E2E测试"
    
    print_info "运行完整的Client Library E2E测试..."
    node client-library-e2e-test.js --config config.yaml --all
    
    if [ $? -eq 0 ]; then
        print_success "完整测试通过"
        return 0
    else
        print_error "完整测试失败"
        return 1
    fi
}

# 运行完整功能测试
run_full_functional_test() {
    print_header "完整功能测试（包含实际交易）"
    
    print_info "运行包含实际交易的完整功能测试..."
    node quick-client-library-test.js --config config.yaml functional
    
    if [ $? -eq 0 ]; then
        print_success "完整功能测试通过"
        return 0
    else
        print_error "完整功能测试失败"
        return 1
    fi
}

# 运行特定测试
run_specific_test() {
    local test_number=$1
    print_header "运行特定测试 #$test_number"
    
    node client-library-e2e-test.js --config config.yaml --test $test_number
    
    if [ $? -eq 0 ]; then
        print_success "测试 #$test_number 通过"
        return 0
    else
        print_error "测试 #$test_number 失败"
        return 1
    fi
}

# 显示测试结果
show_results() {
    print_header "测试结果"
    
    # 查找最新的测试结果文件
    latest_result=$(ls -t client-library-test-results-*.json 2>/dev/null | head -n1)
    
    if [[ -n "$latest_result" ]]; then
        print_info "最新测试结果: $latest_result"
        
        # 显示成功率
        success_rate=$(cat "$latest_result" | grep -o '"successRate":"[^"]*"' | cut -d'"' -f4)
        if [[ -n "$success_rate" ]]; then
            echo -e "成功率: ${GREEN}$success_rate${NC}"
        fi
        
        # 显示失败的测试
        failed_tests=$(cat "$latest_result" | grep -o '"failedTests":[0-9]*' | cut -d':' -f2)
        if [[ "$failed_tests" -gt 0 ]]; then
            print_warning "有 $failed_tests 个测试失败"
        else
            print_success "所有测试通过"
        fi
    else
        print_warning "未找到测试结果文件"
    fi
}

# 显示使用帮助
show_help() {
    echo -e "${BLUE}ZKPay Client Library 测试运行脚本${NC}"
    echo ""
    echo "使用方法:"
    echo "  $0 [选项]"
    echo ""
    echo "选项:"
    echo "  quick           运行快速验证测试（不包含实际交易）"
    echo "  full            运行完整E2E测试"
    echo "  functional      运行完整功能测试（包含实际交易）"
    echo "  test <number>   运行特定编号的测试"
    echo "  results         显示最新测试结果"
    echo "  setup           安装依赖并准备环境"
    echo "  clean           清理测试环境"
    echo "  help            显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 quick                    # 快速验证"
    echo "  $0 full                     # 完整测试"
    echo "  $0 functional               # 包含交易的功能测试"
    echo "  $0 test 5                   # 运行测试#5"
    echo "  $0 setup && $0 quick        # 安装依赖并快速测试"
    echo ""
}

# 主函数
main() {
    case "${1:-help}" in
        "quick")
            check_environment
            cleanup_environment
            run_quick_test
            show_results
            ;;
        "full")
            check_environment
            cleanup_environment
            run_full_test
            show_results
            ;;
        "functional")
            check_environment
            cleanup_environment
            run_full_functional_test
            show_results
            ;;
        "test")
            if [[ -z "$2" ]]; then
                print_error "请指定测试编号"
                echo "使用方法: $0 test <number>"
                exit 1
            fi
            check_environment
            cleanup_environment
            run_specific_test "$2"
            show_results
            ;;
        "results")
            show_results
            ;;
        "setup")
            check_environment
            install_dependencies
            print_success "环境设置完成"
            ;;
        "clean")
            cleanup_environment
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# 执行主函数
main "$@"
