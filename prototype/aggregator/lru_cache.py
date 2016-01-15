class LRUNode(object):
    def __init__(self, id, value, prev=None, next=None):
        self.id = id
        self.value = value
        self.prev = prev
        self.next = next


class LRUCache(object):
    def __init__(self, create_function, capacity=100):
        self.capacity = capacity
        self.create_function = create_function

        self._nodes_by_id = {}  # type: dict[str, LRUNode]
        self._lru_head = None  # type: LRUNode, latest used element
        self._lru_tail = None  # type: LRUNode, least used element

    def _unlink_node(self, node):
        if node is self._lru_head:
            self._lru_head = node.next
        if node is self._lru_tail:
            self._lru_tail = node.prev

        prev = node.prev
        next = node.next

        if prev:
            prev.next = next
        if next:
            next.prev = prev

        node.prev = None
        node.next = None

    def _promote_node(self, node):
        """Moves a node to the head of the list"""
        if node is not self._lru_head:
            self._unlink_node(node)
            node.next = self._lru_head
            self._lru_head.prev = node
            self._lru_head = node

    def _evict_tail(self):
        """Removes the node from the tail of the list"""
        assert (self._lru_tail is not None)

        # tell the object to perform cleaning
        self._lru_tail.value.close()

        # remove it from the index dict
        del self._nodes_by_id[self._lru_tail.id]

        # remove the node from the list
        if self._lru_head is self._lru_tail:
            self._lru_head = None
        new_tail = self._lru_tail.prev
        self._unlink_node(self._lru_tail)
        self._lru_tail = new_tail

    def _insert_new_item(self, id):
        """Creates a new node at the front of the list"""
        value = self.create_function(id)
        node = LRUNode(id, value, next=self._lru_head)
        if self._lru_head:
            self._lru_head.prev = node
        self._lru_head = node
        if self._lru_tail is None:
            self._lru_tail = node
        self._nodes_by_id[id] = node

        return node.value

    def get(self, id):
        """Looks for the object in the LRU. It creates the object if it does not exist."""
        if id in self._nodes_by_id:
            node = self._nodes_by_id[id]
            self._promote_node(node)
            return node.value
        else:
            # The item is not in the cache

            # If the cache is full destroy the least recently used item
            if len(self._nodes_by_id) >= self.capacity:
                self._evict_tail()

            return self._insert_new_item(id)


if __name__ == "__main__":
    import unittest


    class DummyClass(object):
        def __init__(self, id):
            self.id = id
            self.closed = False

        def close(self):
            self.closed = True


    class TestLRU(unittest.TestCase):
        def setUp(self):
            self.cache = LRUCache(DummyClass, capacity=3)

        def read_list(self):
            # Read list forward
            ret_list = []
            node = self.cache._lru_head
            while node:
                ret_list.append(node.id)
                node = node.next

            # Read list backwards
            rev_list = []
            node = self.cache._lru_tail
            while node:
                rev_list.insert(0, node.id)
                node = node.prev

            # Check both versions match
            self.assertEqual(ret_list, rev_list)

            # Check dict and list sizes match
            self.assertEqual(len(ret_list), len(self.cache._nodes_by_id))

            return ret_list

        def test_single_element(self):
            one = self.cache.get(1)
            self.assertIsInstance(one, DummyClass)
            self.assertIs(one, self.cache.get(1))
            self.assertFalse(one.closed)

            self.assertEqual(self.read_list(), [1])

        def test_single_element_evict(self):
            one = self.cache.get(1)
            self.assertIsInstance(one, DummyClass)
            self.assertIs(one, self.cache.get(1))
            self.assertFalse(one.closed)

            self.cache._evict_tail()
            self.assertEqual(self.read_list(), [])
            self.assertIsNone(self.cache._lru_head)
            self.assertIsNone(self.cache._lru_tail)
            self.assertTrue(one.closed)
            self.assertIsNot(one, self.cache.get(1))

        def test_four_elements(self):
            one = self.cache.get(1)
            two = self.cache.get(2)
            self.assertEqual(self.read_list(), [2, 1])
            three = self.cache.get(3)
            self.assertFalse(one.closed)
            four = self.cache.get(4)
            self.assertTrue(one.closed)
            self.assertEqual(self.read_list(), [4, 3, 2])

        def test_four_elements_reused(self):
            one = self.cache.get(1)  # [1]
            two = self.cache.get(2)  # [2,1]
            self.assertIs(one, self.cache.get(1))  # [1,2]
            self.assertEqual(self.read_list(), [1, 2])
            three = self.cache.get(3)  # [3,1,2]
            self.assertEqual(self.read_list(), [3, 1, 2])
            fourth = self.cache.get(4)  # [4,3,1],2
            self.assertTrue(two.closed)
            self.assertFalse(one.closed)
            self.assertEqual(self.read_list(), [4, 3, 1])

        def test_four_elements_reused_different_order(self):
            one = self.cache.get(1)  # [1]
            two = self.cache.get(2)  # [2,1]
            three = self.cache.get(3)  # [3,1,2]
            self.assertIs(two, self.cache.get(2))  # [2,3,1]
            self.assertEqual(self.read_list(), [2, 3, 1])
            fourth = self.cache.get(4)  # [4,2,3],1
            self.assertEqual(self.read_list(), [4, 2, 3])
            self.assertTrue(one.closed)
            self.assertFalse(three.closed)


    unittest.main()
