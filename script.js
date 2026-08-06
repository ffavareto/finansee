"use strict";

const CONFIG = {
  vehicle: {
    assetName: "automóvel",
    termMin: 1,
    termMax: 60,
    termUnit: "meses",
    defaultValues: {
      assetValue: 80000,
      interestRate: 1.49,
      ratePeriod: "month",
      term: 48,
      paymentBudget: 1800,
      entry: 0,
      guide: "payment",
    },
    comparisonTerms: [12, 24, 36, 48, 60],
  },
  property: {
    assetName: "imóvel",
    termMin: 1,
    termMax: 35,
    termUnit: "anos",
    defaultValues: {
      assetValue: 450000,
      interestRate: 11.49,
      ratePeriod: "year",
      term: 30,
      paymentBudget: 3200,
      entry: 0,
      guide: "payment",
    },
    comparisonTerms: [5, 10, 15, 20, 25, 30, 35],
  },
};

const MAX_MONEY_VALUE = 1000000000;
const MAX_MONTHLY_RATE = 100;
const MAX_ANNUAL_RATE = Math.expm1(12 * Math.log1p(MAX_MONTHLY_RATE / 100)) * 100;
const INCOME_COMMITMENT = 0.3;
const EPSILON = 1e-10;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberInputFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const rateInputFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
  useGrouping: false,
});

const profiles = {
  vehicle: createDefaultProfile("vehicle"),
  property: createDefaultProfile("property"),
};

let currentType = "vehicle";

const elements = {
  typeButtons: [...document.querySelectorAll(".type-option")],
  periodButtons: [...document.querySelectorAll(".period-option")],
  resetButton: document.getElementById("resetButton"),
  assetValueLabel: document.getElementById("assetValueLabel"),
  assetValueHint: document.getElementById("assetValueHint"),
  assetValueInput: document.getElementById("assetValueInput"),
  interestRateInput: document.getElementById("interestRateInput"),
  rateHint: document.getElementById("rateHint"),
  termControl: document.getElementById("termControl"),
  termInput: document.getElementById("termInput"),
  termRange: document.getElementById("termRange"),
  termCaption: document.getElementById("termCaption"),
  termUnit: document.getElementById("termUnit"),
  termMinLabel: document.getElementById("termMinLabel"),
  termMaxLabel: document.getElementById("termMaxLabel"),
  paymentControl: document.getElementById("paymentControl"),
  paymentInput: document.getElementById("paymentInput"),
  paymentRange: document.getElementById("paymentRange"),
  paymentCaption: document.getElementById("paymentCaption"),
  paymentMaxLabel: document.getElementById("paymentMaxLabel"),
  paymentGuideBadge: document.getElementById("paymentGuideBadge"),
  entryControl: document.getElementById("entryControl"),
  entryInput: document.getElementById("entryInput"),
  entryRange: document.getElementById("entryRange"),
  entryCaption: document.getElementById("entryCaption"),
  entryMaxLabel: document.getElementById("entryMaxLabel"),
  entryGuideBadge: document.getElementById("entryGuideBadge"),
  primaryResultLabel: document.getElementById("primaryResultLabel"),
  primaryResultValue: document.getElementById("primaryResultValue"),
  primaryResultDescription: document.getElementById("primaryResultDescription"),
  incomePanel: document.getElementById("incomePanel"),
  minimumIncomeValue: document.getElementById("minimumIncomeValue"),
  financedPercentLabel: document.getElementById("financedPercentLabel"),
  entryBar: document.getElementById("entryBar"),
  financedBar: document.getElementById("financedBar"),
  entryLegendValue: document.getElementById("entryLegendValue"),
  financedLegendValue: document.getElementById("financedLegendValue"),
  estimatedPaymentValue: document.getElementById("estimatedPaymentValue"),
  resultTermValue: document.getElementById("resultTermValue"),
  totalPaymentsValue: document.getElementById("totalPaymentsValue"),
  totalInterestValue: document.getElementById("totalInterestValue"),
  totalCostValue: document.getElementById("totalCostValue"),
  resultNote: document.getElementById("resultNote"),
  resultNoteText: document.getElementById("resultNoteText"),
  comparisonDescription: document.getElementById("comparisonDescription"),
  comparisonGrid: document.getElementById("comparisonGrid"),
};

function createDefaultProfile(type) {
  return { ...CONFIG[type].defaultValues };
}

function getProfile() {
  return profiles[currentType];
}

function getTypeConfig() {
  return CONFIG[currentType];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cleanMoney(value) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return 0;
  return Math.max(0, value);
}

function normalizeInputMoney(value) {
  const limitedValue = clamp(cleanMoney(value), 0, MAX_MONEY_VALUE);
  return Math.round((limitedValue + Number.EPSILON) * 100) / 100;
}

function getRateLimit(period) {
  return period === "year" ? MAX_ANNUAL_RATE : MAX_MONTHLY_RATE;
}

function ceilToCent(value) {
  if (value <= 0) return 0;
  return Math.ceil((value - Number.EPSILON) * 100) / 100;
}

function getMonths(term = getProfile().term, type = currentType) {
  return type === "property" ? term * 12 : term;
}

function getMonthlyRate(profile = getProfile()) {
  const statedRate = clamp(Number(profile.interestRate) || 0, 0, getRateLimit(profile.ratePeriod)) / 100;

  if (profile.ratePeriod === "year") {
    return Math.expm1(Math.log1p(statedRate) / 12);
  }

  return statedRate;
}

function getAnnuityFactor(monthlyRate, months) {
  if (months <= 0) return 0;
  if (Math.abs(monthlyRate) < EPSILON) return months;
  return -Math.expm1(-months * Math.log1p(monthlyRate)) / monthlyRate;
}

function calculateScenario(profile, type, term = profile.term) {
  const assetValue = cleanMoney(profile.assetValue);
  const months = getMonths(term, type);
  const monthlyRate = getMonthlyRate(profile);
  const factor = getAnnuityFactor(monthlyRate, months);
  const fullFinancePayment = factor > 0 ? assetValue / factor : 0;

  let entry;
  let desiredPayment = cleanMoney(profile.paymentBudget);

  if (profile.guide === "entry") {
    entry = clamp(cleanMoney(profile.entry), 0, assetValue);
  } else {
    const financeableAmount = desiredPayment * factor;
    entry = clamp(ceilToCent(clamp(assetValue - financeableAmount, 0, assetValue)), 0, assetValue);
  }

  const financedAmount = cleanMoney(assetValue - entry);
  const estimatedPayment = factor > 0 ? financedAmount / factor : 0;

  if (profile.guide === "entry") {
    desiredPayment = estimatedPayment;
  }

  const totalPayments = cleanMoney(estimatedPayment * months);
  const totalInterest = cleanMoney(totalPayments - financedAmount);
  const totalCost = cleanMoney(entry + totalPayments);
  const entryPercent = assetValue > 0 ? clamp((entry / assetValue) * 100, 0, 100) : 0;
  const financedPercent = assetValue > 0 ? clamp(100 - entryPercent, 0, 100) : 0;
  const minimumIncome = type === "property" ? estimatedPayment / INCOME_COMMITMENT : 0;
  const unusedBudget = profile.guide === "payment" ? Math.max(0, desiredPayment - estimatedPayment) : 0;

  return {
    assetValue,
    months,
    monthlyRate,
    factor,
    fullFinancePayment,
    entry,
    financedAmount,
    desiredPayment,
    estimatedPayment,
    totalPayments,
    totalInterest,
    totalCost,
    entryPercent,
    financedPercent,
    minimumIncome,
    unusedBudget,
  };
}

function synchronizeProfile() {
  const profile = getProfile();
  const config = getTypeConfig();

  profile.assetValue = normalizeInputMoney(profile.assetValue);
  profile.interestRate = clamp(Number(profile.interestRate) || 0, 0, getRateLimit(profile.ratePeriod));
  profile.term = Math.round(clamp(Number(profile.term) || config.termMin, config.termMin, config.termMax));
  profile.paymentBudget = normalizeInputMoney(profile.paymentBudget);
  profile.entry = clamp(normalizeInputMoney(profile.entry), 0, profile.assetValue);

  const result = calculateScenario(profile, currentType);
  profile.entry = result.entry;

  if (profile.guide === "entry") {
    profile.paymentBudget = result.estimatedPayment;
  }

  return calculateScenario(profile, currentType);
}

function parseMoneyInput(rawValue) {
  let normalized = String(rawValue).trim().replace(/[^\d,.-]/g, "");
  if (!normalized) return NaN;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  } else if ((normalized.match(/\./g) || []).length > 1) {
    const lastDot = normalized.lastIndexOf(".");
    normalized = `${normalized.slice(0, lastDot).replace(/\./g, "")}${normalized.slice(lastDot)}`;
  }

  return Number(normalized);
}

function parseDecimalInput(rawValue) {
  let normalized = String(rawValue).trim().replace(/[^\d,.-]/g, "");
  if (!normalized) return NaN;

  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }

  return Number(normalized);
}

function formatMoneyInput(value) {
  return numberInputFormatter.format(cleanMoney(value));
}

function formatCurrency(value) {
  return currencyFormatter.format(cleanMoney(value));
}

function formatCompactCurrency(value) {
  return compactCurrencyFormatter.format(cleanMoney(value));
}

function formatPercent(value) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(clamp(value, 0, 100));
}

function formatTerm(term, type = currentType) {
  if (type === "property") return `${term} ${term === 1 ? "ano" : "anos"}`;
  return `${term} ${term === 1 ? "mês" : "meses"}`;
}

function getNiceStep(maximum) {
  if (maximum <= 10000) return 50;
  if (maximum <= 250000) return 100;
  if (maximum <= 2000000) return 1000;
  return 5000;
}

function getNiceMaximum(value) {
  const safeValue = Math.max(1000, cleanMoney(value));
  const magnitude = 10 ** Math.floor(Math.log10(safeValue));
  const normalized = safeValue / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function setRangeProgress(range) {
  const min = Number(range.min) || 0;
  const max = Number(range.max) || 100;
  const value = Number(range.value) || 0;
  const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
  range.style.setProperty("--range-progress", `${clamp(progress, 0, 100)}%`);
}

function setInputValue(input, value, preserveInput) {
  if (preserveInput !== input) input.value = value;
}

function render(options = {}) {
  const preserveInput = options.preserveInput || null;
  const profile = getProfile();
  const config = getTypeConfig();
  const result = synchronizeProfile();

  document.body.dataset.financeType = currentType;

  elements.typeButtons.forEach((button) => {
    const isActive = button.dataset.type === currentType;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  elements.periodButtons.forEach((button) => {
    const isActive = button.dataset.period === profile.ratePeriod;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  elements.assetValueLabel.textContent = `Valor do ${config.assetName}`;
  elements.assetValueHint.textContent = `Informe o valor total do ${config.assetName}`;
  setInputValue(elements.assetValueInput, formatMoneyInput(profile.assetValue), preserveInput);
  setInputValue(elements.interestRateInput, rateInputFormatter.format(profile.interestRate), preserveInput);
  elements.rateHint.textContent = profile.ratePeriod === "month" ? "Taxa efetiva ao mês" : "Taxa efetiva ao ano";

  elements.termRange.min = String(config.termMin);
  elements.termRange.max = String(config.termMax);
  elements.termRange.value = String(profile.term);
  elements.termRange.setAttribute(
    "aria-label",
    currentType === "property" ? "Prazo do financiamento em anos" : "Prazo do financiamento em meses",
  );
  elements.termRange.setAttribute("aria-valuetext", formatTerm(profile.term));
  setInputValue(elements.termInput, String(profile.term), preserveInput);
  elements.termUnit.textContent = config.termUnit;
  elements.termCaption.textContent = `Escolha entre ${formatTerm(config.termMin)} e ${formatTerm(config.termMax)}`;
  elements.termMinLabel.textContent = formatTerm(config.termMin);
  elements.termMaxLabel.textContent = formatTerm(config.termMax);
  setRangeProgress(elements.termRange);

  const basePaymentRangeMax = getNiceMaximum(result.fullFinancePayment * 1.25);
  if (!Number.isFinite(profile.paymentRangeMax) || profile.paymentRangeMax < basePaymentRangeMax) {
    profile.paymentRangeMax = basePaymentRangeMax;
  }
  if (profile.paymentBudget > profile.paymentRangeMax) {
    profile.paymentRangeMax = getNiceMaximum(profile.paymentBudget);
  }
  const paymentRangeMax = profile.paymentRangeMax;
  elements.paymentRange.min = "0";
  elements.paymentRange.max = String(paymentRangeMax);
  elements.paymentRange.step = String(getNiceStep(paymentRangeMax));
  elements.paymentRange.value = String(clamp(profile.paymentBudget, 0, paymentRangeMax));
  elements.paymentRange.setAttribute("aria-valuetext", formatCurrency(profile.paymentBudget));
  setInputValue(elements.paymentInput, formatMoneyInput(profile.paymentBudget), preserveInput);
  elements.paymentMaxLabel.textContent = formatCompactCurrency(paymentRangeMax);
  setRangeProgress(elements.paymentRange);

  const entryRangeMax = Math.max(profile.assetValue, 1);
  elements.entryRange.min = "0";
  elements.entryRange.max = String(entryRangeMax);
  elements.entryRange.step = String(getNiceStep(entryRangeMax));
  elements.entryRange.value = String(clamp(profile.entry, 0, entryRangeMax));
  elements.entryRange.setAttribute("aria-valuetext", formatCurrency(profile.entry));
  setInputValue(elements.entryInput, formatMoneyInput(profile.entry), preserveInput);
  elements.entryMaxLabel.textContent = formatCompactCurrency(profile.assetValue);
  setRangeProgress(elements.entryRange);

  const paymentIsGuide = profile.guide === "payment";
  elements.paymentControl.classList.toggle("is-guide", paymentIsGuide);
  elements.entryControl.classList.toggle("is-guide", !paymentIsGuide);
  elements.paymentGuideBadge.hidden = !paymentIsGuide;
  elements.entryGuideBadge.hidden = paymentIsGuide;
  elements.paymentCaption.textContent = paymentIsGuide
    ? "Quanto você pretende pagar por mês"
    : "Atualizada para respeitar a entrada escolhida";
  elements.entryCaption.textContent = paymentIsGuide
    ? "Calculada a partir da parcela desejada"
    : "Quanto você pretende pagar à vista";

  renderResults(result, profile);
  renderComparison(profile);
}

function renderResults(result, profile) {
  const paymentIsGuide = profile.guide === "payment";

  elements.primaryResultLabel.textContent = paymentIsGuide ? "Entrada necessária" : "Parcela estimada";
  elements.primaryResultValue.textContent = formatCurrency(paymentIsGuide ? result.entry : result.estimatedPayment);
  elements.primaryResultDescription.textContent = paymentIsGuide
    ? "para manter sua parcela dentro do valor desejado"
    : "com a entrada e o prazo que você escolheu";

  elements.incomePanel.hidden = currentType !== "property";
  elements.minimumIncomeValue.textContent = formatCurrency(result.minimumIncome);

  elements.financedPercentLabel.textContent = `${formatPercent(result.financedPercent)}% financiado`;
  elements.entryBar.style.width = `${result.entryPercent}%`;
  elements.financedBar.style.width = `${result.financedPercent}%`;
  elements.entryLegendValue.textContent = formatCompactCurrency(result.entry);
  elements.financedLegendValue.textContent = formatCompactCurrency(result.financedAmount);
  elements.estimatedPaymentValue.textContent = formatCurrency(result.estimatedPayment);
  elements.resultTermValue.textContent = formatTerm(profile.term);
  elements.totalPaymentsValue.textContent = formatCurrency(result.totalPayments);
  elements.totalInterestValue.textContent = formatCurrency(result.totalInterest);
  elements.totalCostValue.textContent = formatCurrency(result.totalCost);

  if (result.assetValue <= 0) {
    elements.resultNoteText.textContent = "Informe o valor do bem para começar a simulação.";
  } else if (paymentIsGuide && result.unusedBudget > 0.01 && result.entry === 0) {
    elements.resultNoteText.textContent = `Você não precisa usar todo o orçamento mensal: ${formatCurrency(result.estimatedPayment)} já financia 100% do bem neste prazo.`;
  } else if (result.entryPercent >= 99.995) {
    elements.resultNoteText.textContent = "Neste cenário, o valor do bem é pago integralmente na entrada e não há saldo financiado.";
  } else if (currentType === "property") {
    elements.resultNoteText.textContent = "A renda mínima é uma referência; cada instituição aplica critérios próprios na análise de crédito.";
  } else {
    elements.resultNoteText.textContent = "Ajuste prazo, parcela ou entrada para encontrar a combinação ideal para o seu orçamento.";
  }
}

function renderComparison(profile) {
  const config = getTypeConfig();
  const terms = [...new Set([...config.comparisonTerms, profile.term])]
    .filter((term) => term >= config.termMin && term <= config.termMax)
    .sort((a, b) => a - b);

  const paymentIsGuide = profile.guide === "payment";
  elements.comparisonDescription.textContent = paymentIsGuide
    ? "Veja a entrada necessária mantendo a mesma parcela desejada."
    : "Veja como a parcela muda mantendo a mesma entrada.";

  elements.comparisonGrid.innerHTML = terms
    .map((term) => {
      const scenario = calculateScenario(profile, currentType, term);
      const isActive = term === profile.term;
      const mainLabel = paymentIsGuide ? "Entrada necessária" : "Parcela estimada";
      const mainValue = paymentIsGuide ? scenario.entry : scenario.estimatedPayment;
      const detailLabel = paymentIsGuide ? "Parcela estimada" : "Mesma entrada";
      const detailValue = paymentIsGuide ? scenario.estimatedPayment : scenario.entry;
      const income =
        currentType === "property"
          ? `<span class="scenario-income">Renda mín. ${formatCompactCurrency(scenario.minimumIncome)}</span>`
          : "";

      return `
        <button
          class="scenario-card${isActive ? " is-active" : ""}"
          type="button"
          data-term="${term}"
          aria-pressed="${isActive}"
          aria-label="Aplicar cenário de ${formatTerm(term)}"
        >
          <span class="scenario-term">${formatTerm(term)}</span>
          <span class="scenario-main">
            <small>${mainLabel}</small>
            <strong>${formatCompactCurrency(mainValue)}</strong>
          </span>
          <span class="scenario-detail">
            <span>${detailLabel}</span>
            <strong>${formatCurrency(detailValue)}</strong>
            ${income}
          </span>
        </button>
      `;
    })
    .join("");
}

function updateMoneyField(field, rawValue) {
  const parsedValue = parseMoneyInput(rawValue);
  if (!Number.isFinite(parsedValue)) return false;

  const profile = getProfile();
  const value = normalizeInputMoney(parsedValue);

  if (field === "assetValue") {
    profile.assetValue = value;
  } else if (field === "paymentBudget") {
    profile.paymentBudget = value;
    profile.guide = "payment";
  } else if (field === "entry") {
    profile.entry = clamp(value, 0, profile.assetValue);
    profile.guide = "entry";
  }

  return true;
}

function bindMoneyInput(input, field) {
  input.addEventListener("input", () => {
    if (updateMoneyField(field, input.value)) render({ preserveInput: input });
  });

  input.addEventListener("blur", () => {
    const parsedValue = parseMoneyInput(input.value);
    if (Number.isFinite(parsedValue)) updateMoneyField(field, input.value);
    render();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });
}

elements.typeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextType = button.dataset.type;
    if (!CONFIG[nextType] || nextType === currentType) return;
    currentType = nextType;
    render();
  });

  button.addEventListener("keydown", (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const nextType = currentType === "vehicle" ? "property" : "vehicle";
    currentType = nextType;
    render();
    document.querySelector(`.type-option[data-type="${nextType}"]`).focus();
  });
});

elements.periodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const profile = getProfile();
    const nextPeriod = button.dataset.period;
    if (nextPeriod === profile.ratePeriod) return;

    const currentDecimalRate = profile.interestRate / 100;
    if (nextPeriod === "year") {
      profile.interestRate = Math.expm1(12 * Math.log1p(currentDecimalRate)) * 100;
    } else {
      profile.interestRate = Math.expm1(Math.log1p(currentDecimalRate) / 12) * 100;
    }

    profile.interestRate = clamp(profile.interestRate, 0, getRateLimit(nextPeriod));
    profile.ratePeriod = nextPeriod;
    render();
  });
});

bindMoneyInput(elements.assetValueInput, "assetValue");
bindMoneyInput(elements.paymentInput, "paymentBudget");
bindMoneyInput(elements.entryInput, "entry");

elements.interestRateInput.addEventListener("input", () => {
  const parsedValue = parseDecimalInput(elements.interestRateInput.value);
  if (!Number.isFinite(parsedValue)) return;
  getProfile().interestRate = clamp(parsedValue, 0, getRateLimit(getProfile().ratePeriod));
  render({ preserveInput: elements.interestRateInput });
});

elements.interestRateInput.addEventListener("blur", () => {
  const parsedValue = parseDecimalInput(elements.interestRateInput.value);
  if (Number.isFinite(parsedValue)) {
    getProfile().interestRate = clamp(parsedValue, 0, getRateLimit(getProfile().ratePeriod));
  }
  render();
});

elements.interestRateInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    elements.interestRateInput.blur();
  }
});

elements.termInput.addEventListener("input", () => {
  const parsedValue = Number.parseInt(elements.termInput.value.replace(/\D/g, ""), 10);
  if (!Number.isFinite(parsedValue)) return;
  const config = getTypeConfig();
  getProfile().term = clamp(parsedValue, config.termMin, config.termMax);
  render({ preserveInput: elements.termInput });
});

elements.termInput.addEventListener("blur", () => render());

elements.termInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    elements.termInput.blur();
  }
});

elements.termRange.addEventListener("input", () => {
  getProfile().term = Number(elements.termRange.value);
  render();
});

elements.paymentRange.addEventListener("input", () => {
  const profile = getProfile();
  profile.paymentBudget = Number(elements.paymentRange.value);
  profile.guide = "payment";
  render();
});

elements.entryRange.addEventListener("input", () => {
  const profile = getProfile();
  profile.entry = Number(elements.entryRange.value);
  profile.guide = "entry";
  render();
});

elements.comparisonGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".scenario-card");
  if (!card) return;

  const term = Number(card.dataset.term);
  const config = getTypeConfig();
  if (!Number.isFinite(term)) return;

  getProfile().term = clamp(term, config.termMin, config.termMax);
  render();

  const activeCard = elements.comparisonGrid.querySelector(".scenario-card.is-active");
  activeCard?.focus({ preventScroll: true });

  if (window.matchMedia("(max-width: 720px)").matches) {
    activeCard?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
});

elements.resetButton.addEventListener("click", () => {
  profiles[currentType] = createDefaultProfile(currentType);
  render();
});

render();
