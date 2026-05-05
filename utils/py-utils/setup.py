from setuptools import setup, find_packages

setup(
    name="utils-py",
    version="0.1.0",
    packages=find_packages(),
    package_data={
        "dl_utils": ["failure_codes.csv"],
    },
)
