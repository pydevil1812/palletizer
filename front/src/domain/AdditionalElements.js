export class AdditionalElements {
  constructor({
    enabled = false,
    useSpacers = false,
    spacerThicknessMm = 0,
    spacerWeightKg = 0,
    useCornerPosts = false,
    cornerPostWeightKg = 0,
    useFilm = false,
    filmWeightKg = 0,
  } = {}) {
    this.enabled = enabled;
    this.useSpacers = useSpacers;
    this.spacerThicknessMm = spacerThicknessMm;
    this.spacerWeightKg = spacerWeightKg;
    this.useCornerPosts = useCornerPosts;
    this.cornerPostWeightKg = cornerPostWeightKg;
    this.useFilm = useFilm;
    this.filmWeightKg = filmWeightKg;
  }
}
