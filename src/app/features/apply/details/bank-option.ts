import type { SelectOption } from '../../../shared/components/select/select-option';
import type { BankItemDto } from '../data-access/application-contract';

const BANK_LOGOS = new Set([
  '011',
  '033',
  '035',
  '044',
  '050',
  '057',
  '058',
  '070',
  '214',
  '215',
  '221',
  '232',
  '301',
]);

export function bankOption(bank: BankItemDto): SelectOption {
  const logoCode = bank.code === '063' ? '044' : bank.code;
  const words = bank.name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(
      (word) =>
        word && !/^(bank|banks|plc|ltd|of|the|for|and|microfinance|mfb|nigeria)$/i.test(word),
    );
  const initials = (words.length ? words : [bank.name])
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
  return {
    value: bank.code,
    label: bank.name,
    logo: BANK_LOGOS.has(logoCode) ? 'banks/' + logoCode + '.svg' : undefined,
    initials: initials || '?',
  };
}
