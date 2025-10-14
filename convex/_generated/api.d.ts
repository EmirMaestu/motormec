/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as appConfig from "../appConfig.js";
import type * as categories from "../categories.js";
import type * as chartData from "../chartData.js";
import type * as clearData from "../clearData.js";
import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as initCustomers from "../initCustomers.js";
import type * as metrics from "../metrics.js";
import type * as migrateVehicles from "../migrateVehicles.js";
import type * as navigation from "../navigation.js";
import type * as partners from "../partners.js";
import type * as products from "../products.js";
import type * as reports from "../reports.js";
import type * as seedAllData from "../seedAllData.js";
import type * as seedData from "../seedData.js";
import type * as transactions from "../transactions.js";
import type * as vehicles from "../vehicles.js";
import type * as vehicles_simplified from "../vehicles_simplified.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  appConfig: typeof appConfig;
  categories: typeof categories;
  chartData: typeof chartData;
  clearData: typeof clearData;
  customers: typeof customers;
  dashboard: typeof dashboard;
  initCustomers: typeof initCustomers;
  metrics: typeof metrics;
  migrateVehicles: typeof migrateVehicles;
  navigation: typeof navigation;
  partners: typeof partners;
  products: typeof products;
  reports: typeof reports;
  seedAllData: typeof seedAllData;
  seedData: typeof seedData;
  transactions: typeof transactions;
  vehicles: typeof vehicles;
  vehicles_simplified: typeof vehicles_simplified;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
