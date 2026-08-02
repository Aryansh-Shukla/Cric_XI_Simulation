/**
 * Catalogue entry point. Importing this module registers every historical
 * squad into the authoring registries. Nothing else should import the
 * individual catalogue files directly.
 */
import "./odi-world-cup";
import "./t20-world-cup";
import "./champions-trophy";
import "./ipl";

export { PLAYER_REGISTRY, PROFILE_REGISTRY, SQUAD_REGISTRY } from "../authoring";
