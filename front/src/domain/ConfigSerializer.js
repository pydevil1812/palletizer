/**
 * Converts between the app's internal camelCase PalletConfig shape and the
 * snake_case JSON schema shared with the bundled Python CLI, so saved files
 * remain interchangeable between the two tools.
 */
export class ConfigSerializer {
  static toExportJSON(config) {
    const { box, pallet, additional } = config;
    return {
      box: { name: box.name, length: box.length, width: box.width, height: box.height, weight: box.weight },
      pallet: {
        name: pallet.name,
        length: pallet.length,
        width: pallet.width,
        deck_height: pallet.deckHeight,
        load_capacity: pallet.loadCapacity,
      },
      max_stack_height: config.maxStackHeight,
      packing_mode: config.packingMode === 'spiral' ? 'spiral' : 'standard',
      orientation_flags: {
        allow_rotate_x: config.orientationFlags.allowRotateX,
        allow_rotate_y: config.orientationFlags.allowRotateY,
        allow_rotate_z: config.orientationFlags.allowRotateZ,
      },
      additional_elements: {
        enabled: additional.enabled,
        use_spacers: additional.useSpacers,
        spacer_thickness_mm: additional.spacerThicknessMm,
        spacer_weight_kg: additional.spacerWeightKg,
        use_corner_posts: additional.useCornerPosts,
        corner_post_weight_kg: additional.cornerPostWeightKg,
        use_film: additional.useFilm,
        film_weight_kg: additional.filmWeightKg,
      },
    };
  }

  /**
   * Accepts either this app's own export schema or the Python CLI's schema
   * (`additional_elements`, `use_corner_posts`) and normalizes into a partial,
   * camelCase patch. Only fields present in the source are included for
   * box/pallet/maxStackHeight, so callers can merge onto existing form state
   * without clobbering untouched fields — mirrors the original app's import
   * behavior of leaving unspecified fields alone.
   */
  static fromImportedJSON(json) {
    if (!json) return {};
    const b = json.box || {};
    const p = json.pallet || {};
    const o = json.orientation_flags || {};
    const a = json.additional || json.additional_elements || {};
    const patch = {};

    const box = {};
    if (b.name != null) box.name = b.name;
    if (b.length != null) box.length = b.length;
    if (b.width != null) box.width = b.width;
    if (b.height != null) box.height = b.height;
    if (b.weight != null) box.weight = b.weight;
    if (Object.keys(box).length) patch.box = box;

    const pallet = {};
    if (p.name != null) pallet.name = p.name;
    if (p.length != null) pallet.length = p.length;
    if (p.width != null) pallet.width = p.width;
    if (p.deck_height != null) pallet.deckHeight = p.deck_height;
    if (p.load_capacity != null) pallet.loadCapacity = p.load_capacity;
    if (Object.keys(pallet).length) patch.pallet = pallet;

    if (json.max_stack_height != null) patch.maxStackHeight = json.max_stack_height;

    patch.packingMode = json.packing_mode === 'spiral' ? 'spiral' : 'standard';

    patch.orientationFlags = {
      allowRotateX: !!o.allow_rotate_x,
      allowRotateY: !!o.allow_rotate_y,
      allowRotateZ: o.allow_rotate_z !== false,
    };

    const additional = {
      enabled: !!a.enabled,
      useSpacers: !!a.use_spacers,
      useCornerPosts: !!a.use_corner_posts || !!a.use_corner,
      useFilm: !!a.use_film,
    };
    if (a.spacer_thickness_mm != null) additional.spacerThicknessMm = a.spacer_thickness_mm;
    if (a.spacer_weight_kg != null) additional.spacerWeightKg = a.spacer_weight_kg;
    if (a.corner_post_weight_kg != null) additional.cornerPostWeightKg = a.corner_post_weight_kg;
    if (a.film_weight_kg != null) additional.filmWeightKg = a.film_weight_kg;
    patch.additional = additional;

    return patch;
  }
}
