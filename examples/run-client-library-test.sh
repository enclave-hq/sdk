#!/bin/bash

# ZKPay Client Library Test Runner Script
# Used to run E2E tests based on client-library

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
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

# CheckEnvironment
check_environment() {
    print_header "EnvironmentCheck"

    # CheckNode.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未Install"
        exit 1
    fi
    print_success "Node.js: $(node --version)"

    # Check是否在正确Directory
    if [[ ! -f "package.json" ]] || [[ ! -d "zkpay-client-library" ]]; then
        print_error "Please在e2e-automationDirectory中Run此Script"
        exit 1
    fi
    print_success "DirectoryCheckPass"

    # CheckConfigurationFile
    if [[ ! -f "config.yaml" ]]; then
        print_error "未找到config.yamlConfigurationFile"
        exit 1
    fi
    print_success "ConfigurationFile存在"

    # Checkclient library
    if [[ ! -f "zkpay-client-library/index.js" ]]; then
        print_error "ZKPay Client Library 未找到"
        exit 1
    fi
    print_success "ZKPay Client Library 存在"
}

# InstallDependencies
install_dependencies() {
    print_header "InstallDependencies"

    print_info "Install主ProjectDependencies..."
    npm install --silent

    print_info "InstallClient LibraryDependencies..."
    cd zkpay-client-library
    npm install --silent
    cd ..

    print_success "DependenciesInstall完成"
}

# CleanupEnvironment
cleanup_environment() {
    print_header "Cleanup测试Environment"

    # CleanupLogFile
    print_info "Cleanup旧LogFile..."
    rm -f e2e-test.log
    rm -f zkpay-client-library/e2e-test.log
    rm -f zkpay-client-library/exceptions.log
    rm -f zkpay-client-library/rejections.log
    rm -f client-library-test-results-*.json

    print_success "EnvironmentCleanup完成"
}

# Run快速验证
run_quick_test() {
    print_header "快速验证测试"

    print_info "RunClient Library快速验证..."
    node quick-client-library-test.js --config config.yaml

    if [ $? -eq 0 ]; then
        print_success "快速验证Pass"
        return 0
    else
        print_error "快速验证失败"
        return 1
    fi
}

# Run完整测试
run_full_test() {
    print_header "完整E2E测试"

    print_info "Run完整的Client Library E2E测试..."
    node client-library-e2e-test.js --config config.yaml --all

    if [ $? -eq 0 ]; then
        print_success "完整测试Pass"
        return 0
    else
        print_error "完整测试失败"
        return 1
    fi
}

# Run完整Function测试
run_full_functional_test() {
    print_header "完整Function测试（包含实际交易）"

    print_info "Run包含实际交易的完整Function测试..."
    node quick-client-library-test.js --config config.yaml functional

    if [ $? -eq 0 ]; then
        print_success "完整Function测试Pass"
        return 0
    else
        print_error "完整Function测试失败"
        return 1
    fi
}

# Run特定测试
run_specific_test() {
    local test_number=$1
    print_header "Run特定测试 #$test_number"

    node client-library-e2e-test.js --config config.yaml --test $test_number

    if [ $? -eq 0 ]; then
        print_success "测试 #$test_number Pass"
        return 0
    else
        print_error "测试 #$test_number 失败"
        return 1
    fi
}

# Display测试Result
show_results() {
    print_header "测试Result"

    # 查找最New测试ResultFile
    latest_result=$(ls -t client-library-test-results-*.json 2>/dev/null | head -n1)

    if [[ -n "$latest_result" ]]; then
        print_info "最新测试Result: $latest_result"

        # DisplaySuccess Rate
        success_rate=$(cat "$latest_result" | grep -o '"successRate":"[^"]*"' | cut -d'"' -f4)
        if [[ -n "$success_rate" ]]; then
            echo -e "Success Rate: ${GREEN}$success_rate${NC}"
        fi

        # Display失败的测试
        failed_tests=$(cat "$latest_result" | grep -o '"failedTests":[0-9]*' | cut -d':' -f2)
        if [[ "$failed_tests" -gt 0 ]]; then
            print_warning "有 $failed_tests 个测试失败"
        else
            print_success "所有测试Pass"
        fi
    else
        print_warning "未找到测试ResultFile"
    fi
}

# DisplayUse帮助
show_help() {
    echo -e "${BLUE}ZKPay Client Library 测试RunScript${NC}"
    echo ""
    echo "UseMethod:"
    echo "  $0 [选项]"
    echo ""
    echo "选项:"
    echo "  quick           Run快速验证测试（不包含实际交易）"
    echo "  full            Run完整E2E测试"
    echo "  functional      Run完整Function测试（包含实际交易）"
    echo "  test <number>   Run特定编号的测试"
    echo "  results         Display最新测试Result"
    echo "  setup           InstallDependencies并准备Environment"
    echo "  clean           Cleanup测试Environment"
    echo "  help            Display此帮助Information"
    echo ""
    echo "示例:"
    echo "  $0 quick                    # 快速验证"
    echo "  $0 full                     # 完整测试"
    echo "  $0 functional               # 包含交易的Function测试"
    echo "  $0 test 5                   # Run测试#5"
    echo "  $0 setup && $0 quick        # InstallDependencies并快速测试"
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
                print_error "Please指定测试编号"
                echo "UseMethod: $0 test <number>"
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
            print_success "Environment设置完成"
            ;;
        "clean")
            cleanup_environment
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Execute主函数
main "$@"
