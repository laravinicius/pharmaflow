// Tipos de dados — usados em toda a aplicação
// O acesso ao banco é feito exclusivamente via src/services/lanDatabase.ts

export interface User {
  id: number;
  name: string;
  username: string;
  role: 'admin' | 'employee';
}

export interface Customer {
  id: number;
  name: string;
  cpf: string;
  phone: string;
}

export interface Material {
  id: number;
  name: string;
}

export interface FormulaItem {
  material_id: number;
  material_name: string;
  quantity: number;
}

export interface Formula {
  id: number;
  customer_id: number;
  customer_name: string;
  status: 'pending' | 'completed';
  created_at: string;
  items: FormulaItem[];
}
