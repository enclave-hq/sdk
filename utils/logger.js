// Log Manager

const winston = require("winston");
const path = require("path");

/**
 * Create logger
 */
function createLogger(label = "ZKPayE2E", config = {}) {
  const logConfig = {
    level: config.level || "info",
    file: config.file || "e2e-test.log",
    maxSize: config.maxSize || "10MB",
    maxFiles: config.maxFiles || 5,
    consoleOutput: config.consoleOutput !== false,
    detailedErrors: config.detailedErrors !== false,
  };

  // Log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.label({ label }),
    winston.format.errors({ stack: logConfig.detailedErrors }),
    winston.format.printf(({ timestamp, label, level, message, stack }) => {
      const prefix = `${timestamp} [${label}] ${level.toUpperCase()}:`;
      if (stack) {
        return `${prefix} ${message}\n${stack}`;
      }
      return `${prefix} ${message}`;
    })
  );

  // 控制台格式（带颜色）
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "HH:mm:ss" }),
    winston.format.label({ label }),
    winston.format.printf(({ timestamp, label, level, message }) => {
      return `${timestamp} [${label}] ${level}: ${message}`;
    })
  );

  const transports = [
    // 文件日志
    new winston.transports.File({
      filename: path.resolve(logConfig.file),
      format: logFormat,
      maxsize: logConfig.maxSize,
      maxFiles: logConfig.maxFiles,
      tailable: true,
    }),
  ];

  // 控制台日志
  if (logConfig.consoleOutput) {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
      })
    );
  }

  return winston.createLogger({
    level: logConfig.level,
    transports,
    // 处理未捕获的异常
    exceptionHandlers: [
      new winston.transports.File({ filename: path.resolve("exceptions.log") }),
    ],
    // 处理未处理的Promise拒绝
    rejectionHandlers: [
      new winston.transports.File({ filename: path.resolve("rejections.log") }),
    ],
  });
}

/**
 * 测试结果记录器
 */
class TestResultLogger {
  constructor(logger) {
    this.logger = logger;
    this.testResults = [];
    this.currentTest = null;
    this.startTime = null;
  }

  startTest(testName, description = "") {
    this.currentTest = {
      name: testName,
      description,
      startTime: new Date(),
      endTime: null,
      duration: null,
      status: "running",
      steps: [],
      errors: [],
      metadata: {},
    };

    this.startTime = this.currentTest.startTime;
    this.logger.info(`🧪 开始测试: ${testName}`);
    if (description) {
      this.logger.info(`📝 测试描述: ${description}`);
    }
  }

  addStep(stepName, details = null) {
    if (!this.currentTest) {
      throw new Error("没有活动的测试");
    }

    // 处理BigInt序列化问题
    let processedDetails = details;
    if (details !== null && typeof details === "object") {
      try {
        processedDetails = JSON.parse(
          JSON.stringify(details, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        );
      } catch (error) {
        // 如果序列化失败，将details设为错误信息
        processedDetails = { error: `无法序列化details: ${error.message}` };
      }
    }

    const step = {
      name: stepName,
      timestamp: new Date(),
      details: processedDetails,
      status: "completed",
    };

    this.currentTest.steps.push(step);
    this.logger.info(`✅ 步骤完成: ${stepName}`);

    if (details) {
      try {
        const detailsStr = JSON.stringify(
          details,
          (key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          2
        );
        this.logger.debug(`🔍 步骤详情: ${detailsStr}`);
      } catch (error) {
        this.logger.debug(`🔍 步骤详情: [无法序列化: ${error.message}]`);
      }
    }
  }

  addError(error, stepName = null) {
    if (!this.currentTest) {
      throw new Error("没有活动的测试");
    }

    const errorInfo = {
      message: error.message,
      stack: error.stack,
      stepName,
      timestamp: new Date(),
    };

    this.currentTest.errors.push(errorInfo);
    this.logger.error(
      `❌ 测试错误${stepName ? ` (${stepName})` : ""}: ${error.message}`
    );

    if (error.stack) {
      this.logger.debug(`🔍 错误堆栈:\n${error.stack}`);
    }
  }

  setMetadata(key, value) {
    if (!this.currentTest) {
      throw new Error("没有活动的测试");
    }

    // 处理BigInt序列化问题
    let processedValue = value;
    if (value !== null && typeof value === "object") {
      try {
        processedValue = JSON.parse(
          JSON.stringify(value, (key, val) =>
            typeof val === "bigint" ? val.toString() : val
          )
        );
      } catch (error) {
        // 如果序列化失败，将value设为错误信息
        processedValue = { error: `无法序列化metadata: ${error.message}` };
      }
    }

    this.currentTest.metadata[key] = processedValue;
  }

  finishTest(status = "completed") {
    if (!this.currentTest) {
      throw new Error("没有活动的测试");
    }

    this.currentTest.endTime = new Date();
    this.currentTest.duration =
      this.currentTest.endTime - this.currentTest.startTime;
    this.currentTest.status = status;

    // 如果有错误，状态应该是失败
    if (this.currentTest.errors.length > 0 && status === "completed") {
      this.currentTest.status = "failed";
    }

    this.testResults.push(this.currentTest);

    const durationStr = `${this.currentTest.duration}ms`;
    const statusIcon = this.currentTest.status === "completed" ? "✅" : "❌";

    this.logger.info(
      `${statusIcon} 测试完成: ${this.currentTest.name} (${durationStr})`
    );
    this.logger.info(`📊 测试状态: ${this.currentTest.status}`);
    this.logger.info(`📈 完成步骤: ${this.currentTest.steps.length}`);
    this.logger.info(`🐛 错误数量: ${this.currentTest.errors.length}`);

    this.currentTest = null;
  }

  generateSummary() {
    const totalTests = this.testResults.length;
    const completedTests = this.testResults.filter(
      (t) => t.status === "completed"
    ).length;
    const failedTests = this.testResults.filter(
      (t) => t.status === "failed"
    ).length;
    const totalDuration = this.testResults.reduce(
      (sum, t) => sum + (t.duration || 0),
      0
    );

    const summary = {
      totalTests,
      completedTests,
      failedTests,
      successRate:
        totalTests > 0 ? ((completedTests / totalTests) * 100).toFixed(2) : 0,
      totalDuration,
      avgDuration: totalTests > 0 ? (totalDuration / totalTests).toFixed(2) : 0,
      results: this.testResults,
    };

    this.logger.info("📋 测试总结:");
    this.logger.info(`   总测试数: ${totalTests}`);
    this.logger.info(`   成功: ${completedTests}`);
    this.logger.info(`   失败: ${failedTests}`);
    this.logger.info(`   成功率: ${summary.successRate}%`);
    this.logger.info(`   总耗时: ${totalDuration}ms`);
    this.logger.info(`   平均耗时: ${summary.avgDuration}ms`);

    return summary;
  }

  saveResults(filename) {
    const summary = this.generateSummary();
    const fs = require("fs");
    const path = require("path");

    const resultsFile = path.resolve(
      filename || `test-results-${Date.now()}.json`
    );
    fs.writeFileSync(
      resultsFile,
      JSON.stringify(
        summary,
        (key, value) => (typeof value === "bigint" ? value.toString() : value),
        2
      )
    );

    this.logger.info(`💾 测试结果已保存: ${resultsFile}`);
    return resultsFile;
  }
}

module.exports = {
  createLogger,
  TestResultLogger,
};
