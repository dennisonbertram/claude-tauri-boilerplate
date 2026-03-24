import { FormSchemaRegistry } from '../types';
import { w9_2024 } from './w9';

export const globalRegistry = new FormSchemaRegistry();
globalRegistry.register(w9_2024);

export { w9_2024 };
