"""
Test Data Generator (DataGen)
Enterprise-grade random data generation for API testing
Comparable to ReadyAPI's DataGen TestStep and Postman's Dynamic Variables

Supports:
- Names (first, last, full)
- Emails, usernames
- Addresses (street, city, state, zip, country)
- Phone numbers
- Numbers (integers, floats, ranges)
- Dates and timestamps
- UUIDs, GUIDs
- Credit card numbers (test only)
- Booleans
- Lorem ipsum text
- Custom patterns/regex
- Sequential values
- Random selection from lists
"""

import logging
import random
import string
import re
import hashlib
import math
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from uuid import uuid4
from functools import lru_cache

logger = logging.getLogger(__name__)


# Data pools for realistic data generation
FIRST_NAMES_MALE = [
    "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph",
    "Thomas", "Christopher", "Charles", "Daniel", "Matthew", "Anthony", "Mark",
    "Donald", "Steven", "Paul", "Andrew", "Joshua", "Kenneth", "Kevin", "Brian",
    "George", "Timothy", "Ronald", "Edward", "Jason", "Jeffrey", "Ryan"
]

FIRST_NAMES_FEMALE = [
    "Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth", "Susan",
    "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Margaret", "Sandra",
    "Ashley", "Kimberly", "Emily", "Donna", "Michelle", "Dorothy", "Carol",
    "Amanda", "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon", "Laura"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"
]

STREET_NAMES = [
    "Main", "Oak", "Maple", "Cedar", "Pine", "Elm", "Washington", "Lake",
    "Hill", "Park", "River", "Sunset", "Spring", "Valley", "Church", "Forest",
    "Highland", "Meadow", "Willow", "Grove", "First", "Second", "Third", "Fourth"
]

STREET_TYPES = ["St", "Ave", "Blvd", "Dr", "Ln", "Rd", "Way", "Ct", "Pl", "Cir"]

CITIES = [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
    "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
    "Fort Worth", "Columbus", "Charlotte", "San Francisco", "Indianapolis",
    "Seattle", "Denver", "Boston", "Portland", "Atlanta", "Miami", "Detroit"
]

STATES = [
    ("AL", "Alabama"), ("AK", "Alaska"), ("AZ", "Arizona"), ("AR", "Arkansas"),
    ("CA", "California"), ("CO", "Colorado"), ("CT", "Connecticut"), ("DE", "Delaware"),
    ("FL", "Florida"), ("GA", "Georgia"), ("HI", "Hawaii"), ("ID", "Idaho"),
    ("IL", "Illinois"), ("IN", "Indiana"), ("IA", "Iowa"), ("KS", "Kansas"),
    ("KY", "Kentucky"), ("LA", "Louisiana"), ("ME", "Maine"), ("MD", "Maryland"),
    ("MA", "Massachusetts"), ("MI", "Michigan"), ("MN", "Minnesota"), ("MS", "Mississippi"),
    ("MO", "Missouri"), ("MT", "Montana"), ("NE", "Nebraska"), ("NV", "Nevada"),
    ("NH", "New Hampshire"), ("NJ", "New Jersey"), ("NM", "New Mexico"), ("NY", "New York"),
    ("NC", "North Carolina"), ("ND", "North Dakota"), ("OH", "Ohio"), ("OK", "Oklahoma"),
    ("OR", "Oregon"), ("PA", "Pennsylvania"), ("RI", "Rhode Island"), ("SC", "South Carolina"),
    ("SD", "South Dakota"), ("TN", "Tennessee"), ("TX", "Texas"), ("UT", "Utah"),
    ("VT", "Vermont"), ("VA", "Virginia"), ("WA", "Washington"), ("WV", "West Virginia"),
    ("WI", "Wisconsin"), ("WY", "Wyoming")
]

COUNTRIES = [
    "United States", "United Kingdom", "Canada", "Australia", "Germany", "France",
    "Japan", "China", "India", "Brazil", "Mexico", "Italy", "Spain", "Netherlands",
    "Sweden", "Norway", "Denmark", "Finland", "Switzerland", "Belgium"
]

EMAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "example.com",
    "test.com", "company.com", "mail.com", "email.com", "inbox.com"
]

COMPANY_SUFFIXES = ["Inc", "LLC", "Corp", "Ltd", "Co", "Group", "Holdings", "Solutions"]

LOREM_WORDS = [
    "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
    "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
    "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
    "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
    "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
    "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
    "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
    "deserunt", "mollit", "anim", "id", "est", "laborum"
]


class TestDataGenerator:
    """
    Test Data Generator with support for various data types
    
    Usage:
        gen = TestDataGenerator()
        
        # Generate random data
        name = gen.generate("firstName")
        email = gen.generate("email")
        number = gen.generate("integer", min=1, max=100)
        
        # Generate from pattern
        custom = gen.generate("pattern", pattern="PROD-####-XX")
        
        # Generate with seed for reproducibility
        gen = TestDataGenerator(seed=12345)
    """
    
    def __init__(self, seed: Optional[int] = None):
        """Initialize generator with optional seed for reproducibility"""
        self.seed = seed
        if seed is not None:
            random.seed(seed)
        
        self.sequence_counters: Dict[str, int] = {}
        
        # Data type handlers
        self.generators = {
            # Names
            "firstName": self._gen_first_name,
            "lastName": self._gen_last_name,
            "fullName": self._gen_full_name,
            "maleFirstName": lambda **kw: random.choice(FIRST_NAMES_MALE),
            "femaleFirstName": lambda **kw: random.choice(FIRST_NAMES_FEMALE),
            "username": self._gen_username,
            
            # Contact
            "email": self._gen_email,
            "phone": self._gen_phone,
            "phoneInternational": self._gen_phone_international,
            
            # Address
            "streetAddress": self._gen_street_address,
            "city": lambda **kw: random.choice(CITIES),
            "state": self._gen_state,
            "stateAbbr": self._gen_state_abbr,
            "zipCode": self._gen_zip_code,
            "country": lambda **kw: random.choice(COUNTRIES),
            "fullAddress": self._gen_full_address,
            
            # Numbers
            "integer": self._gen_integer,
            "float": self._gen_float,
            "decimal": self._gen_decimal,
            
            # Identifiers
            "uuid": lambda **kw: str(uuid4()),
            "guid": lambda **kw: str(uuid4()),
            "objectId": self._gen_object_id,
            
            # Dates/Times
            "date": self._gen_date,
            "datetime": self._gen_datetime,
            "timestamp": self._gen_timestamp,
            "isoDate": self._gen_iso_date,
            "pastDate": self._gen_past_date,
            "futureDate": self._gen_future_date,
            
            # Financial
            "creditCard": self._gen_credit_card,
            "creditCardExpiry": self._gen_credit_card_expiry,
            "cvv": self._gen_cvv,
            "price": self._gen_price,
            "currency": self._gen_currency,
            
            # Boolean
            "boolean": lambda **kw: random.choice([True, False]),
            "yesNo": lambda **kw: random.choice(["yes", "no"]),
            "truefalse": lambda **kw: random.choice(["true", "false"]),
            
            # Text
            "word": lambda **kw: random.choice(LOREM_WORDS),
            "sentence": self._gen_sentence,
            "paragraph": self._gen_paragraph,
            "lorem": self._gen_lorem,
            
            # Strings
            "alphanumeric": self._gen_alphanumeric,
            "alpha": self._gen_alpha,
            "numeric": self._gen_numeric,
            "hex": self._gen_hex,
            "base64": self._gen_base64,
            
            # Patterns
            "pattern": self._gen_pattern,
            "regex": self._gen_regex,
            
            # Collections
            "randomElement": self._gen_random_element,
            "sequential": self._gen_sequential,
            "weighted": self._gen_weighted,
            
            # Company
            "companyName": self._gen_company_name,
            "jobTitle": self._gen_job_title,
            
            # Internet
            "url": self._gen_url,
            "domain": lambda **kw: random.choice(EMAIL_DOMAINS),
            "ipv4": self._gen_ipv4,
            "ipv6": self._gen_ipv6,
            "macAddress": self._gen_mac_address,
            "userAgent": self._gen_user_agent,
            
            # Color
            "hexColor": self._gen_hex_color,
            "rgbColor": self._gen_rgb_color,
        }
    
    def generate(self, data_type: str, **kwargs) -> Any:
        """
        Generate random data of the specified type
        
        Args:
            data_type: Type of data to generate (e.g., "email", "integer", "uuid")
            **kwargs: Additional parameters for the generator
            
        Returns:
            Generated data value
        """
        if data_type not in self.generators:
            raise ValueError(f"Unknown data type: {data_type}. Available: {list(self.generators.keys())}")
        
        return self.generators[data_type](**kwargs)
    
    def generate_batch(self, data_type: str, count: int, **kwargs) -> List[Any]:
        """Generate multiple values of the same type"""
        return [self.generate(data_type, **kwargs) for _ in range(count)]
    
    def generate_object(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate an object based on a schema definition
        
        Args:
            schema: Dictionary mapping field names to generator configs
                    Example: {"name": {"type": "fullName"}, "age": {"type": "integer", "min": 18, "max": 65}}
        
        Returns:
            Generated object
        """
        result = {}
        for field_name, field_config in schema.items():
            if isinstance(field_config, str):
                # Simple type string
                result[field_name] = self.generate(field_config)
            elif isinstance(field_config, dict):
                data_type = field_config.pop("type", "string")
                result[field_name] = self.generate(data_type, **field_config)
                field_config["type"] = data_type  # Restore
            else:
                result[field_name] = field_config
        return result
    
    # ==================== Name Generators ====================
    
    def _gen_first_name(self, gender: str = None, **kwargs) -> str:
        if gender == "male":
            return random.choice(FIRST_NAMES_MALE)
        elif gender == "female":
            return random.choice(FIRST_NAMES_FEMALE)
        return random.choice(FIRST_NAMES_MALE + FIRST_NAMES_FEMALE)
    
    def _gen_last_name(self, **kwargs) -> str:
        return random.choice(LAST_NAMES)
    
    def _gen_full_name(self, gender: str = None, **kwargs) -> str:
        return f"{self._gen_first_name(gender)} {self._gen_last_name()}"
    
    def _gen_username(self, **kwargs) -> str:
        first = self._gen_first_name().lower()
        last = self._gen_last_name().lower()
        num = random.randint(1, 999)
        patterns = [
            f"{first}{last}",
            f"{first}.{last}",
            f"{first}_{last}",
            f"{first}{num}",
            f"{first}.{last}{num}",
            f"{first[0]}{last}",
        ]
        return random.choice(patterns)
    
    # ==================== Contact Generators ====================
    
    def _gen_email(self, domain: str = None, **kwargs) -> str:
        username = self._gen_username()
        domain = domain or random.choice(EMAIL_DOMAINS)
        return f"{username}@{domain}"
    
    def _gen_phone(self, format: str = "(###) ###-####", **kwargs) -> str:
        result = ""
        for char in format:
            if char == "#":
                result += str(random.randint(0, 9))
            else:
                result += char
        return result
    
    def _gen_phone_international(self, **kwargs) -> str:
        country_codes = ["+1", "+44", "+49", "+33", "+81", "+86", "+91"]
        code = random.choice(country_codes)
        number = "".join(str(random.randint(0, 9)) for _ in range(10))
        return f"{code} {number[:3]} {number[3:6]} {number[6:]}"
    
    # ==================== Address Generators ====================
    
    def _gen_street_address(self, **kwargs) -> str:
        num = random.randint(1, 9999)
        street = random.choice(STREET_NAMES)
        suffix = random.choice(STREET_TYPES)
        return f"{num} {street} {suffix}"
    
    def _gen_state(self, **kwargs) -> str:
        return random.choice(STATES)[1]
    
    def _gen_state_abbr(self, **kwargs) -> str:
        return random.choice(STATES)[0]
    
    def _gen_zip_code(self, format: str = "#####", **kwargs) -> str:
        return self._gen_phone(format=format)
    
    def _gen_full_address(self, **kwargs) -> str:
        street = self._gen_street_address()
        city = random.choice(CITIES)
        state = self._gen_state_abbr()
        zip_code = self._gen_zip_code()
        return f"{street}, {city}, {state} {zip_code}"
    
    # ==================== Number Generators ====================
    
    def _gen_integer(self, min: int = 0, max: int = 1000000, **kwargs) -> int:
        return random.randint(min, max)
    
    def _gen_float(self, min: float = 0.0, max: float = 1000.0, precision: int = 2, **kwargs) -> float:
        value = random.uniform(min, max)
        return round(value, precision)
    
    def _gen_decimal(self, min: float = 0.0, max: float = 1000.0, precision: int = 2, **kwargs) -> str:
        value = self._gen_float(min, max, precision)
        return f"{value:.{precision}f}"
    
    # ==================== Identifier Generators ====================
    
    def _gen_object_id(self, **kwargs) -> str:
        """Generate MongoDB-style ObjectId"""
        timestamp = int(datetime.utcnow().timestamp())
        counter = random.randint(0, 16777215)
        machine = random.randint(0, 16777215)
        process = random.randint(0, 65535)
        return f"{timestamp:08x}{machine:06x}{process:04x}{counter:06x}"
    
    # ==================== Date/Time Generators ====================
    
    def _gen_date(self, format: str = "%Y-%m-%d", start_year: int = 2000, end_year: int = 2030, **kwargs) -> str:
        start = datetime(start_year, 1, 1)
        end = datetime(end_year, 12, 31)
        days_diff = (end - start).days
        random_date = start + timedelta(days=random.randint(0, days_diff))
        return random_date.strftime(format)
    
    def _gen_datetime(self, format: str = "%Y-%m-%dT%H:%M:%S", **kwargs) -> str:
        date = self._gen_date(format="%Y-%m-%d", **kwargs)
        hour = random.randint(0, 23)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        dt = datetime.strptime(date, "%Y-%m-%d") + timedelta(hours=hour, minutes=minute, seconds=second)
        return dt.strftime(format)
    
    def _gen_timestamp(self, **kwargs) -> int:
        return int(datetime.strptime(self._gen_datetime(), "%Y-%m-%dT%H:%M:%S").timestamp())
    
    def _gen_iso_date(self, **kwargs) -> str:
        return self._gen_datetime(format="%Y-%m-%dT%H:%M:%SZ")
    
    def _gen_past_date(self, days_back: int = 365, format: str = "%Y-%m-%d", **kwargs) -> str:
        past = datetime.utcnow() - timedelta(days=random.randint(1, days_back))
        return past.strftime(format)
    
    def _gen_future_date(self, days_ahead: int = 365, format: str = "%Y-%m-%d", **kwargs) -> str:
        future = datetime.utcnow() + timedelta(days=random.randint(1, days_ahead))
        return future.strftime(format)
    
    # ==================== Financial Generators ====================
    
    def _gen_credit_card(self, type: str = "visa", **kwargs) -> str:
        """Generate test credit card number (NOT valid for transactions)"""
        prefixes = {
            "visa": ["4"],
            "mastercard": ["51", "52", "53", "54", "55"],
            "amex": ["34", "37"],
            "discover": ["6011", "65"]
        }
        prefix = random.choice(prefixes.get(type, prefixes["visa"]))
        length = 15 if type == "amex" else 16
        
        # Generate random digits
        number = prefix
        while len(number) < length - 1:
            number += str(random.randint(0, 9))
        
        # Add Luhn check digit
        number += self._luhn_checksum(number)
        return number
    
    def _luhn_checksum(self, number: str) -> str:
        """Calculate Luhn algorithm checksum"""
        def digits_of(n):
            return [int(d) for d in str(n)]
        digits = digits_of(number)
        odd_digits = digits[-1::-2]
        even_digits = digits[-2::-2]
        checksum = sum(odd_digits)
        for d in even_digits:
            checksum += sum(digits_of(d * 2))
        return str((10 - (checksum % 10)) % 10)
    
    def _gen_credit_card_expiry(self, **kwargs) -> str:
        month = random.randint(1, 12)
        year = datetime.utcnow().year + random.randint(1, 5)
        return f"{month:02d}/{str(year)[-2:]}"
    
    def _gen_cvv(self, length: int = 3, **kwargs) -> str:
        return "".join(str(random.randint(0, 9)) for _ in range(length))
    
    def _gen_price(self, min: float = 0.99, max: float = 999.99, **kwargs) -> str:
        value = round(random.uniform(min, max), 2)
        return f"{value:.2f}"
    
    def _gen_currency(self, **kwargs) -> str:
        currencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY"]
        return random.choice(currencies)
    
    # ==================== Text Generators ====================
    
    def _gen_sentence(self, word_count: int = None, **kwargs) -> str:
        count = word_count or random.randint(5, 15)
        words = [random.choice(LOREM_WORDS) for _ in range(count)]
        sentence = " ".join(words)
        return sentence.capitalize() + "."
    
    def _gen_paragraph(self, sentence_count: int = None, **kwargs) -> str:
        count = sentence_count or random.randint(3, 7)
        sentences = [self._gen_sentence() for _ in range(count)]
        return " ".join(sentences)
    
    def _gen_lorem(self, paragraphs: int = 1, **kwargs) -> str:
        return "\n\n".join(self._gen_paragraph() for _ in range(paragraphs))
    
    # ==================== String Generators ====================
    
    def _gen_alphanumeric(self, length: int = 10, **kwargs) -> str:
        chars = string.ascii_letters + string.digits
        return "".join(random.choice(chars) for _ in range(length))
    
    def _gen_alpha(self, length: int = 10, case: str = "mixed", **kwargs) -> str:
        if case == "upper":
            chars = string.ascii_uppercase
        elif case == "lower":
            chars = string.ascii_lowercase
        else:
            chars = string.ascii_letters
        return "".join(random.choice(chars) for _ in range(length))
    
    def _gen_numeric(self, length: int = 10, **kwargs) -> str:
        return "".join(str(random.randint(0, 9)) for _ in range(length))
    
    def _gen_hex(self, length: int = 16, **kwargs) -> str:
        return "".join(random.choice("0123456789abcdef") for _ in range(length))
    
    def _gen_base64(self, length: int = 16, **kwargs) -> str:
        import base64
        random_bytes = bytes(random.randint(0, 255) for _ in range(length))
        return base64.b64encode(random_bytes).decode()[:length]
    
    # ==================== Pattern Generators ====================
    
    def _gen_pattern(self, pattern: str = "XXX-####", **kwargs) -> str:
        """
        Generate string from pattern:
        - # = digit (0-9)
        - X = uppercase letter
        - x = lowercase letter
        - * = alphanumeric
        - ? = any printable character
        """
        result = ""
        for char in pattern:
            if char == "#":
                result += str(random.randint(0, 9))
            elif char == "X":
                result += random.choice(string.ascii_uppercase)
            elif char == "x":
                result += random.choice(string.ascii_lowercase)
            elif char == "*":
                result += random.choice(string.ascii_letters + string.digits)
            elif char == "?":
                result += random.choice(string.printable.strip())
            else:
                result += char
        return result
    
    def _gen_regex(self, regex: str = "[A-Z]{3}\\d{4}", **kwargs) -> str:
        """
        Generate string matching simple regex pattern
        Supports: [A-Z], [a-z], [0-9], \\d, \\w, {n}, {n,m}, +, *
        """
        # This is a simplified regex-based generator
        # For complex regex, consider using exrex or rstr libraries
        result = ""
        i = 0
        while i < len(regex):
            char = regex[i]
            
            if char == "[":
                # Character class
                end = regex.find("]", i)
                char_class = regex[i+1:end]
                
                # Check for quantifier
                quantifier = self._parse_quantifier(regex[end+1:])
                count = self._resolve_quantifier(quantifier)
                
                for _ in range(count):
                    result += self._gen_from_char_class(char_class)
                
                i = end + 1 + len(quantifier.get("raw", ""))
                
            elif char == "\\" and i + 1 < len(regex):
                # Escape sequence
                next_char = regex[i + 1]
                quantifier = self._parse_quantifier(regex[i+2:])
                count = self._resolve_quantifier(quantifier)
                
                for _ in range(count):
                    if next_char == "d":
                        result += str(random.randint(0, 9))
                    elif next_char == "w":
                        result += random.choice(string.ascii_letters + string.digits + "_")
                    elif next_char == "s":
                        result += " "
                    else:
                        result += next_char
                
                i += 2 + len(quantifier.get("raw", ""))
                
            else:
                result += char
                i += 1
        
        return result
    
    def _gen_from_char_class(self, char_class: str) -> str:
        """Generate character from character class like A-Z, 0-9"""
        chars = []
        i = 0
        while i < len(char_class):
            if i + 2 < len(char_class) and char_class[i + 1] == "-":
                # Range
                start = ord(char_class[i])
                end = ord(char_class[i + 2])
                chars.extend(chr(c) for c in range(start, end + 1))
                i += 3
            else:
                chars.append(char_class[i])
                i += 1
        return random.choice(chars) if chars else ""
    
    def _parse_quantifier(self, text: str) -> Dict[str, Any]:
        """Parse quantifier like {3}, {2,5}, +, *, ?"""
        if not text:
            return {"min": 1, "max": 1, "raw": ""}
        
        if text.startswith("{"):
            end = text.find("}")
            if end == -1:
                return {"min": 1, "max": 1, "raw": ""}
            
            content = text[1:end]
            raw = text[:end+1]
            
            if "," in content:
                parts = content.split(",")
                min_val = int(parts[0]) if parts[0] else 0
                max_val = int(parts[1]) if parts[1] else min_val + 5
                return {"min": min_val, "max": max_val, "raw": raw}
            else:
                val = int(content)
                return {"min": val, "max": val, "raw": raw}
        
        elif text.startswith("+"):
            return {"min": 1, "max": 5, "raw": "+"}
        elif text.startswith("*"):
            return {"min": 0, "max": 5, "raw": "*"}
        elif text.startswith("?"):
            return {"min": 0, "max": 1, "raw": "?"}
        
        return {"min": 1, "max": 1, "raw": ""}
    
    def _resolve_quantifier(self, quantifier: Dict[str, Any]) -> int:
        return random.randint(quantifier["min"], quantifier["max"])
    
    # ==================== Collection Generators ====================
    
    def _gen_random_element(self, items: List[Any] = None, **kwargs) -> Any:
        """Select random element from list"""
        if not items:
            return None
        return random.choice(items)
    
    def _gen_sequential(self, name: str = "default", start: int = 1, step: int = 1, **kwargs) -> int:
        """Generate sequential number"""
        if name not in self.sequence_counters:
            self.sequence_counters[name] = start
        
        value = self.sequence_counters[name]
        self.sequence_counters[name] += step
        return value
    
    def _gen_weighted(self, items: List[Any] = None, weights: List[float] = None, **kwargs) -> Any:
        """Select element with weighted probability"""
        if not items:
            return None
        if not weights:
            return random.choice(items)
        return random.choices(items, weights=weights, k=1)[0]
    
    # ==================== Company Generators ====================
    
    def _gen_company_name(self, **kwargs) -> str:
        last_name = self._gen_last_name()
        suffix = random.choice(COMPANY_SUFFIXES)
        patterns = [
            f"{last_name} {suffix}",
            f"{last_name} & {self._gen_last_name()} {suffix}",
            f"{last_name} Industries",
            f"{last_name} Technologies",
            f"Global {last_name}",
        ]
        return random.choice(patterns)
    
    def _gen_job_title(self, **kwargs) -> str:
        prefixes = ["Senior", "Junior", "Lead", "Chief", "Principal", "Associate", ""]
        titles = ["Engineer", "Developer", "Manager", "Analyst", "Designer", "Architect",
                  "Consultant", "Director", "Specialist", "Administrator", "Coordinator"]
        areas = ["Software", "Data", "Product", "Marketing", "Sales", "Operations",
                 "Finance", "HR", "IT", "Security", "Quality"]
        
        prefix = random.choice(prefixes)
        area = random.choice(areas)
        title = random.choice(titles)
        
        return f"{prefix} {area} {title}".strip()
    
    # ==================== Internet Generators ====================
    
    def _gen_url(self, protocol: str = "https", **kwargs) -> str:
        domain = random.choice(EMAIL_DOMAINS)
        paths = ["", "/products", "/users", "/api", "/about", "/contact", "/services"]
        return f"{protocol}://{domain}{random.choice(paths)}"
    
    def _gen_ipv4(self, **kwargs) -> str:
        return ".".join(str(random.randint(0, 255)) for _ in range(4))
    
    def _gen_ipv6(self, **kwargs) -> str:
        return ":".join(f"{random.randint(0, 65535):04x}" for _ in range(8))
    
    def _gen_mac_address(self, separator: str = ":", **kwargs) -> str:
        return separator.join(f"{random.randint(0, 255):02x}" for _ in range(6))
    
    def _gen_user_agent(self, **kwargs) -> str:
        agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"
        ]
        return random.choice(agents)
    
    # ==================== Color Generators ====================
    
    def _gen_hex_color(self, **kwargs) -> str:
        return f"#{random.randint(0, 16777215):06x}"
    
    def _gen_rgb_color(self, **kwargs) -> str:
        r = random.randint(0, 255)
        g = random.randint(0, 255)
        b = random.randint(0, 255)
        return f"rgb({r}, {g}, {b})"
    
    # ==================== Utility Methods ====================
    
    def list_types(self) -> List[str]:
        """List all available data types"""
        return sorted(self.generators.keys())
    
    def reset_sequences(self):
        """Reset all sequence counters"""
        self.sequence_counters.clear()
    
    def reset_seed(self, seed: Optional[int] = None):
        """Reset random seed"""
        self.seed = seed
        if seed is not None:
            random.seed(seed)


# Global instance
_test_data_generator: Optional[TestDataGenerator] = None


def get_test_data_generator(seed: int = None) -> TestDataGenerator:
    """Get or create TestDataGenerator instance"""
    global _test_data_generator
    if _test_data_generator is None or seed is not None:
        _test_data_generator = TestDataGenerator(seed=seed)
    return _test_data_generator


# Convenience functions for common types
def random_email() -> str:
    return get_test_data_generator().generate("email")

def random_name() -> str:
    return get_test_data_generator().generate("fullName")

def random_uuid() -> str:
    return get_test_data_generator().generate("uuid")

def random_integer(min: int = 0, max: int = 1000) -> int:
    return get_test_data_generator().generate("integer", min=min, max=max)

def random_phone() -> str:
    return get_test_data_generator().generate("phone")
