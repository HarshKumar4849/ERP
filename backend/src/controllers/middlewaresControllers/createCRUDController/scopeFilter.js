/**
 * Builds the mandatory access-scope filter for generic CRUD list
 * operations.
 *
 * rbacMiddleware mutates req.query with ownership/department constraints
 * (employee, user, department, authorizedEmployee and the filter/equal
 * pair) before a controller runs. The generic CRUD list implementations
 * must honour those constraints - otherwise any role permitted to "list"
 * an entity could read every document in the collection (IDOR).
 *
 * Only fields that actually exist on the model schema are applied, so
 * virtual filter concepts (e.g. authorizedEmployee on Project) are left
 * to the dedicated controllers that know how to interpret them.
 */

const SCOPE_QUERY_KEYS = ['employee', 'user', 'department', 'authorizedEmployee'];

const buildScopeFilter = (Model, req) => {
  const scope = {};

  for (const key of SCOPE_QUERY_KEYS) {
    const value = req.query && req.query[key];
    if (!value || value === 'all') {
      continue;
    }
    // Only apply when the model actually has this field
    if (Model.schema && Model.schema.paths && Model.schema.paths[key]) {
      scope[key] = value;
    }
  }

  // Honour the generic filter/equal pair (also used by rbacMiddleware to
  // scope salary queries to the requesting user).
  const filter = req.query && req.query.filter;
  const equal = req.query && req.query.equal;
  if (
    filter &&
    equal !== undefined &&
    typeof equal !== 'object' &&
    Model.schema &&
    Model.schema.paths &&
    Model.schema.paths[filter]
  ) {
    scope[filter] = equal;
  }

  return scope;
};

module.exports = { buildScopeFilter, SCOPE_QUERY_KEYS };
