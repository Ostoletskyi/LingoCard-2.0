export const STATUS = {
  OK: "OK",
  FAIL: "FAIL",
  SKIP: "SKIP"
};

export const createResultCollector = () => {
  const steps = [];

  const addStep = ({ label, status, details = "", blocking = true }) => {
    steps.push({ label, status, details, blocking });
  };

  const getSummary = () => {
    const blockingFailures = steps.filter((step) => step.blocking && step.status === STATUS.FAIL);
    const pass = blockingFailures.length === 0;
    return {
      pass,
      code: pass ? 0 : 1,
      blockingFailures: blockingFailures.length,
      steps
    };
  };

  const toMarkdown = () => {
    const lines = ["# Smoke Report", ""];
    for (const step of steps) {
      const details = step.details ? ` - ${step.details}` : "";
      const blockingMark = step.blocking ? "" : " (non-blocking)";
      lines.push(`- **${step.label}**: ${step.status}${blockingMark}${details}`);
    }
    const summary = getSummary();
    lines.push("");
    lines.push(`- **Overall**: ${summary.pass ? "PASS" : "FAIL"}`);
    return `${lines.join("\n")}\n`;
  };

  const toJson = () => {
    const summary = getSummary();
    return {
      generatedAt: new Date().toISOString(),
      overall: {
        pass: summary.pass,
        code: summary.code,
        blockingFailures: summary.blockingFailures
      },
      steps
    };
  };

  return {
    addStep,
    getSummary,
    toMarkdown,
    toJson
  };
};

export const classifyReportFromJson = (payload) => {
  const pass = Boolean(payload?.overall?.pass);
  const code = Number.isFinite(payload?.overall?.code) ? Number(payload.overall.code) : pass ? 0 : 1;
  return { pass, code };
};
