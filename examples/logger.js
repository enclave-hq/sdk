// Log manager

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

  // 控制台Format（带颜色）
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "HH:mm:ss" }),
    winston.format.label({ label }),
    winston.format.printf(({ timestamp, label, level, message }) => {
      return `${timestamp} [${label}] ${level}: ${message}`;
    })
  );

  const transports = [
    // FileLog
    new winston.transports.File({
      filename: path.resolve(logConfig.file),
      format: logFormat,
      maxsize: logConfig.maxSize,
      maxFiles: logConfig.maxFiles,
      tailable: true,
    }),
  ];

  // 控制台Log
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
    // Process未捕获的异常
    exceptionHandlers: [
      new winston.transports.File({ filename: path.resolve("exceptions.log") }),
    ],
    // Process未Process的Promise拒绝
    rejectionHandlers: [
      new winston.transports.File({ filename: path.resolve("rejections.log") }),
    ],
  });
}

/**
 * TestResult记录器
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
    this.logger.info(`🧪 StartingTest: ${testName}`);
    if (description) {
      this.logger.info(`📝 Test描述: ${description}`);
    }
  }

  addStep(stepName, details = null) {
    if (!this.currentTest) {
      throw new Error("没有Active的Test");
    }

    // ProcessBigIntSerializationIssue
    let processedDetails = details;
    if (details !== null && typeof details === "object") {
      try {
        processedDetails = JSON.parse(
          JSON.stringify(details, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        );
      } catch (error) {
        // 如果Serializationfailed，将details设为ErrorInformation
        processedDetails = { error: `CannotSerializationdetails: ${error.message}` };
      }
    }

    const step = {
      name: stepName,
      timestamp: new Date(),
      details: processedDetails,
      status: "completed",
    };

    this.currentTest.steps.push(step);
    this.logger.info(`✅ Stepcompleted: ${stepName}`);

    if (details) {
      try {
        const detailsStr = JSON.stringify(
          details,
          (key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          2
        );
        this.logger.debug(`🔍 StepDetails: ${detailsStr}`);
      } catch (error) {
        this.logger.debug(`🔍 StepDetails: [CannotSerialization: ${error.message}]`);
      }
    }
  }

  addError(error, stepName = null) {
    if (!this.currentTest) {
      throw new Error("没有Active的Test");
    }

    const errorInfo = {
      message: error.message,
      stack: error.stack,
      stepName,
      timestamp: new Date(),
    };

    this.currentTest.errors.push(errorInfo);
    this.logger.error(
      `❌ TestError${stepName ? ` (${stepName})` : ""}: ${error.message}`
    );

    if (error.stack) {
      this.logger.debug(`🔍 ErrorStack:\n${error.stack}`);
    }
  }

  setMetadata(key, value) {
    if (!this.currentTest) {
      throw new Error("没有Active的Test");
    }

    // ProcessBigIntSerializationIssue
    let processedValue = value;
    if (value !== null && typeof value === "object") {
      try {
        processedValue = JSON.parse(
          JSON.stringify(value, (key, val) =>
            typeof val === "bigint" ? val.toString() : val
          )
        );
      } catch (error) {
        // 如果Serializationfailed，将value设为ErrorInformation
        processedValue = { error: `CannotSerializationmetadata: ${error.message}` };
      }
    }

    this.currentTest.metadata[key] = processedValue;
  }

  finishTest(status = "completed") {
    if (!this.currentTest) {
      throw new Error("没有Active的Test");
    }

    this.currentTest.endTime = new Date();
    this.currentTest.duration =
      this.currentTest.endTime - this.currentTest.startTime;
    this.currentTest.status = status;

    // 如果有Error，StatusShould是failed
    if (this.currentTest.errors.length > 0 && status === "completed") {
      this.currentTest.status = "failed";
    }

    this.testResults.push(this.currentTest);

    const durationStr = `${this.currentTest.duration}ms`;
    const statusIcon = this.currentTest.status === "completed" ? "✅" : "❌";

    this.logger.info(
      `${statusIcon} Testcompleted: ${this.currentTest.name} (${durationStr})`
    );
    this.logger.info(`📊 TestStatus: ${this.currentTest.status}`);
    this.logger.info(`📈 completedStep: ${this.currentTest.steps.length}`);
    this.logger.info(`🐛 ErrorCount: ${this.currentTest.errors.length}`);

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

    this.logger.info("📋 TestSummary:");
    this.logger.info(`   总Test数: ${totalTests}`);
    this.logger.info(`   successful: ${completedTests}`);
    this.logger.info(`   failed: ${failedTests}`);
    this.logger.info(`   successful率: ${summary.successRate}%`);
    this.logger.info(`   总Duration: ${totalDuration}ms`);
    this.logger.info(`   AverageDuration: ${summary.avgDuration}ms`);

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

    this.logger.info(`💾 TestResultSaved: ${resultsFile}`);
    return resultsFile;
  }
}

module.exports = {
  createLogger,
  TestResultLogger,
};
