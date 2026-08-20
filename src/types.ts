export interface User { id: number; name: string; username: string; role: 'admin' | 'employee' }
export interface Customer { id: number; name: string; phone: string; created_at?: string }
export interface Insumo { id: number; name: string; created_at?: string }
export interface FormulaItem { insumo_id: number; insumo_name: string; quantity: number; unit?: string }
export interface BudgetItem { quantity: number; unit: string; value: number; is_selected?: boolean }
export interface Formula {
  id: number; customer_id: number; customer_name: string; customer_phone: string;
  pharmacist_name: string; status: 'pending' | 'completed' | 'confirmed' | 'cancelled' | 'delivered';
  created_at: string; items: FormulaItem[]; budget_number?: string; budget_items?: BudgetItem[];
  attendant_name?: string; delivery_date?: string | null;
  payment_status?: string; payment_method?: string | null;
  delivery_status?: string; cancel_reason?: string | null;
}
export interface SavedFormulaItem { insumo_id: number; insumo_name?: string; quantity: number; unit?: string }
export interface SavedFormula { id: number; name: string; created_at?: string; items: SavedFormulaItem[] }