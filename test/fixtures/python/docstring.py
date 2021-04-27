class ComplexNumber:
	"""
	This is a class for mathematical operations on complex numbers.

	Attributes:
		real (int): The real part of complex number.
		imag (int): The imaginary part of complex number.
	"""

	def __init__(self, real, imag):
		"""
		The constructor for ComplexNumber class.

		Parameters:
		real (int): The real part of complex number.
		imag (int): The imaginary part of complex number.
		"""

	def add(self, num):
		"""
		The function to add two Complex Numbers.

		Parameters:
			num (ComplexNumber): The complex number to be added.

		Returns:
			ComplexNumber: A complex number which contains the sum.
		"""

		re = self.real + num.real
		im = self.imag + num.imag

		return ComplexNumber(re, im)


help(ComplexNumber)  # to access Class docstring
help(ComplexNumber.add)  # to access method's docstring
