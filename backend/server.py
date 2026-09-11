import importlib
import sys
from pathlib import Path
from types import ModuleType

package_root = Path(__file__).resolve().parent
package = sys.modules.setdefault('backend', ModuleType('backend'))
package.__path__ = [str(package_root)]

app = importlib.import_module('backend.main').app
