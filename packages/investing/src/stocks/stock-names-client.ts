/**
 * Client-Safe Stock Names Export
 *
 * This module is safe to import in browser/client components.
 * It only contains the stock names data and utility functions,
 * without any server-side dependencies.
 */

export { stockNames, cleanCompanyName } from './stock-names';
export type { StockNameEntry } from './stock-names';
