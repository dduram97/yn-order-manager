import bcrypt from "bcryptjs";

const run = async () => {
  const hash = await bcrypt.hash("Admin1234!", 12);
  console.log(hash);
};

run();