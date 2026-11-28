/**
 * Formatting and formatting helper utilities for Hachi Tech POS
 * Includes Dual Currency (USD $ and KHR ៛ Riel)
 */

export const DEFAULT_EXCHANGE_RATE = 4100; // 1 USD = 4,100 KHR

export function formatCurrency(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return '$0.00';
  return '$' + num.toFixed(2);
}

export function formatKHR(amount) {
  const num = Math.round(parseFloat(amount) || 0);
  return num.toLocaleString() + '៛';
}

export function usdToKhr(usdAmount, exchangeRate = DEFAULT_EXCHANGE_RATE) {
  const usd = parseFloat(usdAmount) || 0;
  return Math.round(usd * exchangeRate);
}

export function khrToUsd(khrAmount, exchangeRate = DEFAULT_EXCHANGE_RATE) {
  const khr = parseFloat(khrAmount) || 0;
  return Math.round((khr / exchangeRate) * 100) / 100;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

// Generate color-coded stock status badge classes
export function getStockStatus(stockQty, lowThreshold = 5) {
  const qty = parseInt(stockQty, 10);
  const threshold = parseInt(lowThreshold, 10);

  if (qty <= 0) {
    return {
      status: 'Out of Stock',
      badgeClass: 'bg-pink-100 text-pink-600 border-pink-200',
      dotClass: 'bg-pink-500',
      isLow: true,
      isOut: true
    };
  }
  if (qty <= threshold) {
    return {
      status: `Low Stock (${qty})`,
      badgeClass: 'bg-pink-50 text-pink-500 border-pink-200',
      dotClass: 'bg-pink-400',
      isLow: true,
      isOut: false
    };
  }
  return {
    status: `${qty} In Stock`,
    badgeClass: 'bg-sky-100 text-sky-600 border-sky-200',
    dotClass: 'bg-sky-400',
    isLow: false,
    isOut: false
  };
}
