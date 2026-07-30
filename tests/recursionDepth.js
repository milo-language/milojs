function countDown(n) {
  if (n <= 0) return 0;
  return countDown(n - 1) + 1;
}

console.log(countDown(100));

function forever() {
  return forever();
}

try {
  forever();
} catch (error) {
  console.log(error.name, error.message);
}
