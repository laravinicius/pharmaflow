// Formata em tempo de digitação: DDD entre parênteses após 2 dígitos,
// aceita fixo (00) 0000-0000 (10 dígitos) ou celular (00) 00000-0000 (11 dígitos)
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length === 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

export function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, '').length === 11;
}

// Máscara de moeda (R$): dígitos digitados viram centavos — ex.: "123456" → "1.234,56"
export function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 15);
  if (!digits) return '';
  const cents = digits.padStart(3, '0');
  const reais = (cents.slice(0, -2).replace(/^0+/, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reais},${cents.slice(-2)}`;
}

// Converte texto com máscara de moeda para número (ex.: "1.234,56" → 1234.56)
export function parseCurrency(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
}

// Máscara de data ao digitar (ex.: "15082026" → "15/08/2026")
export function formatDateBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// Converte "DD/MM/AAAA" (ou "ddmmaaaa") para ISO "AAAA-MM-DD";
// valida data real (dias do mês e ano bissexto). Retorna null se inválida.
export function parseDateBR(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const dd = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const yyyy = Number(digits.slice(4));
  if (mm < 1 || mm > 12 || dd < 1) return null;
  const daysInMonth = new Date(yyyy, mm, 0).getDate();
  if (dd > daysInMonth) return null;
  return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

// Converte ISO "AAAA-MM-DD" para exibição "DD/MM/AAAA"
export function formatDateToBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Remove acentos para comparação na busca (ex.: "jose" encontra "José")
export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Formata quantidade: remove zeros à direita; usa . para milhar, , para decimal
// ex.: 2 → "2", 2.5 → "2,5", 2.500 → "2,5", 1234.5 → "1.234,5", 1000000 → "1.000.000"
export function formatQuantity(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Number.isInteger(n)) return n.toLocaleString('pt-BR');
  const str = n.toString();
  const decimals = str.split('.')[1]?.replace(/0+$/, '') ?? '';
  return decimals
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: decimals.length, maximumFractionDigits: decimals.length })
    : n.toLocaleString('pt-BR');
}

// Máscara de quantidade ao digitar: aceita até 6 dígitos, insere separador de milhar (.)
// ex.: "123456" → "123.456", "1234" → "1.234", "12" → "12"
export function formatQuantityInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Converte quantidade com máscara de volta para número
// ex.: "123.456" → 123456, "1.234" → 1234
export function parseQuantity(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}