const STUDENTS = {
  '20002547': {
    id: '20002547',
    name: 'John Paul',
    department: 'CCICT',
    year: '4th year',
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

export const getStudentByID = (studentId) => {
  const student = STUDENTS[studentId];
  if (!student) {
    console.warn(`Student ID ${studentId} not found in database`);
    return null;
  }
  return student;
};

export const isValidStudentID = (studentId) => {
  return studentId in STUDENTS;
};

export const getAllValidStudentIDs = () => {
  return Object.keys(STUDENTS);
};

export const getFaceImagePath = (studentId) => {
  const student = STUDENTS[studentId];
  return student ? student.faceImage : null;
};

export const addStudent = (studentData) => {
  if (!studentData.id || !studentData.name || !studentData.faceImage) {
    throw new Error('Missing required student data');
  }
  STUDENTS[studentData.id] = studentData;
  console.log(`Added student: ${studentData.name} (${studentData.id})`);
};

export default {
  getStudentByID,
  isValidStudentID,
  getAllValidStudentIDs,
  getFaceImagePath,
  addStudent
};
