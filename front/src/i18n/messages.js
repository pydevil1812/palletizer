const FLAG_ORIENTATION_KEY = {
  allow_rotate_x: 'rotateX',
  allow_rotate_y: 'rotateY',
  allow_rotate_z: 'rotateZ',
};

/** Renders a `{code, params}` validation error (see api.py `validate_config`) via `t`. */
export function formatError(t, err) {
  if (typeof err === 'string') return err;
  return t(`errors.${err.code}`, err.params ?? {});
}

/** Renders a `{code, params}` recommendation (see packer.py `_build_recommendations`) via `t`. */
export function formatRecommendation(t, rec) {
  if (typeof rec === 'string') return rec;
  const { code, params = {} } = rec;
  if (code === 'lowFillWithDisabledFlags') {
    const flags = (params.flags ?? [])
      .map((f) => t(`orientations.${FLAG_ORIENTATION_KEY[f] ?? f}`))
      .join(', ');
    return t(`recommendations.codes.${code}`, { ...params, flags });
  }
  return t(`recommendations.codes.${code}`, params);
}
