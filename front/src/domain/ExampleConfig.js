// In the Python-CLI-compatible schema, run through ConfigSerializer.fromImportedJSON
// the same way a loaded JSON file would be, so there is a single source of truth
// for how that schema maps onto the app's internal config shape.
export const EXAMPLE_CONFIG_JSON = {
  box: { name: 'Carton A', length: 400, width: 300, height: 250, weight: 8.5 },
  pallet: { name: 'EUR pallet (1200x800)', length: 1200, width: 800, deck_height: 150, load_capacity: 700 },
  max_stack_height: 1800,
  orientation_flags: { allow_rotate_x: false, allow_rotate_y: false, allow_rotate_z: true },
  additional_elements: {
    enabled: true,
    use_spacers: true,
    spacer_thickness_mm: 5,
    spacer_weight_kg: 0.3,
    use_corner_posts: false,
    corner_post_weight_kg: 0,
    use_film: true,
    film_weight_kg: 1.2,
  },
};
