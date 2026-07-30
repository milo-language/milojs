function recurseApply() {
  recurseApply.apply(null);
}

function recurseCall() {
  recurseCall.call(null);
}

for (const recurse of [recurseApply, recurseCall]) {
  try {
    recurse();
  } catch (error) {
    console.log(error.name, error.message);
  }
}
