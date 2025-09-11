#!/usr/bin/env node

/**
 * 检查Test USDT合约信息
 * 地址: 0x76bf8c42C0E8325a74352D924Ddfaa6a3344F80D
 */

const { ethers } = require('ethers');

async function checkTestUSDT() {
  console.log('🔍 检查Test USDT合约信息\n');
  
  const contractAddress = '0x76bf8c42C0E8325a74352D924Ddfaa6a3344F80D';
  const rpcUrl = 'https://bsc-dataseed1.binance.org/';
  
  try {
    // 连接到BSC网络
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    console.log('🌐 网络信息:');
    const network = await provider.getNetwork();
    console.log(`   链ID: ${network.chainId}`);
    console.log(`   网络名: ${network.name || 'BSC'}`);
    console.log('');
    
    console.log('📋 合约信息:');
    console.log(`   地址: ${contractAddress}`);
    
    // 检查合约代码
    const code = await provider.getCode(contractAddress);
    console.log(`   是否为合约: ${code !== '0x' ? '✅ 是' : '❌ 否'}`);
    console.log(`   代码长度: ${code.length - 2} bytes`);
    console.log('');
    
    // 尝试调用ERC20标准方法
    const erc20ABI = [
      "function name() view returns (string)",
      "function symbol() view returns (string)", 
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)"
    ];
    
    const contract = new ethers.Contract(contractAddress, erc20ABI, provider);
    
    console.log('🪙 代币信息:');
    
    try {
      const name = await contract.name();
      console.log(`   名称: ${name}`);
    } catch (e) {
      console.log(`   名称: ❌ 无法获取 (${e.message.split('.')[0]})`);
    }
    
    try {
      const symbol = await contract.symbol();
      console.log(`   符号: ${symbol}`);
    } catch (e) {
      console.log(`   符号: ❌ 无法获取 (${e.message.split('.')[0]})`);
    }
    
    try {
      const decimals = await contract.decimals();
      console.log(`   精度: ${decimals}`);
    } catch (e) {
      console.log(`   精度: ❌ 无法获取 (${e.message.split('.')[0]})`);
    }
    
    try {
      const totalSupply = await contract.totalSupply();
      console.log(`   总供应量: ${ethers.formatUnits(totalSupply, 6)} (假设6位精度)`);
    } catch (e) {
      console.log(`   总供应量: ❌ 无法获取 (${e.message.split('.')[0]})`);
    }
    
    console.log('');
    
    // 检查一些测试地址的余额
    const testAddresses = [
      '0x742d35Cc6635C0532925a3b8D9B85e0fEd2e4e9d',
      '0x8ba1f109551bD432803012645Hac136c30F0B77C',
      '0x0000000000000000000000000000000000000000'
    ];
    
    console.log('💰 测试地址余额:');
    for (const addr of testAddresses) {
      try {
        const balance = await contract.balanceOf(addr);
        const formattedBalance = ethers.formatUnits(balance, 6);
        console.log(`   ${addr}: ${formattedBalance} TUSDT`);
      } catch (e) {
        console.log(`   ${addr}: ❌ 查询失败`);
      }
    }
    
    console.log('');
    console.log('🔗 浏览器链接:');
    console.log(`   BSCScan: https://bscscan.com/token/${contractAddress}`);
    console.log(`   合约代码: https://bscscan.com/address/${contractAddress}#code`);
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

// 运行检查
if (require.main === module) {
  checkTestUSDT().catch(console.error);
}

module.exports = { checkTestUSDT };
