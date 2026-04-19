const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
console.log("anil@gmail:", regex.test("anil@gmail"));
console.log("anil@gmail.com:", regex.test("anil@gmail.com"));
