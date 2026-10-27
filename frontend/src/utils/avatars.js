// Maps the avatar KEY stored on the user (backend) to the imported illustrated PNG.
// New users are assigned one of these four at random on the backend.
import boy from "../components/avatars/boy_2323446.png";
import pilot from "../components/avatars/pilot_5101588.png";
import student from "../components/avatars/student_10156005.png";
import gamer from "../components/avatars/gamer_4333682.png";

export const AVATARS = { boy, pilot, student, gamer };
export const AVATAR_KEYS = ["boy", "pilot", "student", "gamer"];

// Resolve a user's avatar image. Returns null when the key is unknown so callers
// can fall back to an initial.
export function avatarSrc(key) {
    return AVATARS[key] || null;
}
