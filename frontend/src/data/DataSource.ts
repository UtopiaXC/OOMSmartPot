import type { Query, Series } from './types';

/**
 * Abstraction over any backend that can answer sensor queries.
 * Components depend on this interface only — never on concrete classes.
 */
export interface DataSource {
  query(q: Query): Promise<Series>;
}
