// Levels of detail by distance and zoom. Pure, so the logic tests can run it.
// Each threshold is where a part of the scenery shrinks to a few pixels.

// Single leaves cover only a few pixels beyond these: trees and shrubs draw
// coarser foliage in the overview above COARSE_LEAVES_VIEW_HEIGHT and in
// first person beyond COARSE_LEAVES_DISTANCE; trees further off than
// CROWN_DISTANCE, deep in the fog, draw their crown shells instead.
export const COARSE_LEAVES_VIEW_HEIGHT = 24,
  COARSE_LEAVES_DISTANCE = 18,
  CROWN_DISTANCE = 40,
  // Zoomed out past this, a pebble, a tuft or a fallen leaf is a pixel or
  // less: the overview hides the brook's pebbles and bank tufts and the
  // litter and moss at the trees' feet, and the people and animals stop
  // casting shadows (their soft contact shadows stay). Grass and blossoms
  // stay; their speckle is the meadow's texture from above.
  FAR_DETAIL_VIEW_HEIGHT = 30;

/** First person: a canopy's leaf level from its distance to the eye. */
export const leafLevelAtDistance = (distance) =>
  distance > CROWN_DISTANCE ? 2 : distance > COARSE_LEAVES_DISTANCE ? 1 : 0;

/** The overview's leaf level for trees and shrubs at a view height. */
export const overviewLeafLevel = (viewHeight) =>
  viewHeight > COARSE_LEAVES_VIEW_HEIGHT ? 1 : 0;

/** Whether the overview at a view height keeps its finest detail. */
export const overviewFineDetail = (viewHeight) => viewHeight <= FAR_DETAIL_VIEW_HEIGHT;
