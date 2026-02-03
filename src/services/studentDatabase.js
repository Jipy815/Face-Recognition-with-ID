/**
 * Student Database Service
 * Maps student IDs to their profile data and face reference images
 * This is the central registry for ID → Face verification
 */

const STUDENTS = {
  '2201521': {
    id: '2201521',
    name: 'John Paul',
    department: 'Computer Science',
    year: 'Junior',
    faceImage: '/uploads/mememe.jpg',
    email: 'john.doe@university.edu'
  },
  '2201547': {
    id: '2201547',
    name: 'Jane Smith',
    department: 'Engineering',
    year: 'Senior',
    faceImage: '/uploads/jungkok.jpg',
    email: 'jane.smith@university.edu'
  }
};

/**
 * Get student data by ID
 * @param {string} studentId - 7-digit student ID
 * @returns {Object|null} Student data or null if not found
 */
export const getStudentByID = (studentId) => {
  const student = STUDENTS[studentId];
  if (!student) {
    console.warn(`Student ID ${studentId} not found in database`);
    return null;
  }
  return student;
};

/**
 * Check if student ID exists in database
 * @param {string} studentId - 7-digit student ID
 * @returns {boolean}
 */
export const isValidStudentID = (studentId) => {
  return studentId in STUDENTS;
};

/**
 * Get all valid student IDs (for whitelist validation)
 * @returns {string[]} Array of valid student IDs
 */
export const getAllValidStudentIDs = () => {
  return Object.keys(STUDENTS);
};

/**
 * Get face reference image path for a student
 * @param {string} studentId - 7-digit student ID
 * @returns {string|null} Image path or null
 */
export const getFaceImagePath = (studentId) => {
  const student = STUDENTS[studentId];
  return student ? student.faceImage : null;
};

/**
 * Add new student to database (for admin use)
 * @param {Object} studentData - Student information
 */
export const addStudent = (studentData) => {
  if (!studentData.id || !studentData.name || !studentData.faceImage) {
    throw new Error('Missing required student data');
  }
  STUDENTS[studentData.id] = studentData;
  console.log(`✅ Added student: ${studentData.name} (${studentData.id})`);
};

export default {
  getStudentByID,
  isValidStudentID,
  getAllValidStudentIDs,
  getFaceImagePath,
  addStudent
};
